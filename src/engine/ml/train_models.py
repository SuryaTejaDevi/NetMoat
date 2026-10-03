import numpy as np
import pandas as pd
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, f1_score
from imblearn.over_sampling import SMOTE
import joblib
import json
import os
import glob
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType

# Import our new extractor
from feature_extractor import FeatureExtractor

def generate_strict_synthetic_data(n_sessions=500):
    """
    Generates 'Raw' time-series logs that mimic AWID/CRAWDAD patterns.
    This creates the input for the FeatureExtractor, NOT the final features.
    """
    print("Generating High-Fidelity Synthetic Time-Series Data...")
    np.random.seed(42)
    
    logs = []
    
    # 1. Benign Sessions (Stable, Secure, Consistent)
    for i in range(n_sessions):
        duration = np.random.randint(10, 60) # 10-60 samples
        base_rssi = np.random.normal(-60, 5)
        
        # Generate stable timeline
        timestamps = pd.date_range(start='2025-01-01', periods=duration, freq='2S')
        rssi = np.random.normal(base_rssi, 2, duration) # Low variance
        channel = np.full(duration, np.random.choice([1, 6, 11]))
        
        for t, r, c in zip(timestamps, rssi, channel):
            logs.append({
                'session_id': f'benign_{i}',
                'timestamp': t,
                'rssi': r,
                'channel': c,
                'ssid': 'Corporate_WiFi',
                'bssid': f'00:11:22:33:44:{i%100:02x}',
                'encryption': 'WPA2',
                'ssid_similarity': 0.0,
                'is_duplicate_ssid': 0,
                'label': 'Safe'
            })

    # 2. Rogue / Evil Twin (High Variance, Approach, Channel Hopping)
    for i in range(n_sessions // 2):
        duration = np.random.randint(5, 40)
        # "Approaching" pattern
        rssi = np.linspace(-90, -40, duration) + np.random.normal(0, 8, duration) # High noise
        timestamps = pd.date_range(start='2025-01-01', periods=duration, freq='1S') # Faster scans
        
        # Channel hopping
        channel = np.random.choice([1, 2, 3, 4, 5, 6], duration)
        
        for t, r, c in zip(timestamps, rssi, channel):
            logs.append({
                'session_id': f'rogue_{i}',
                'timestamp': t,
                'rssi': r,
                'channel': c,
                'ssid': 'Free_WiFi', # Suspicious name
                'bssid': f'DE:AD:BE:EF:{i%100:02x}',
                'encryption': 'Open',
                'ssid_similarity': 0.9, # Masquerading
                'is_duplicate_ssid': 1,
                'label': 'Rogue'
            })
            
    return pd.DataFrame(logs)

def train_industrial_pipeline():
    # 1. Pipeline Setup
    extractor = FeatureExtractor()
    
    # 2. Data Ingestion
    # In real world: Load CSVs. Here: Generate Raw Logs.
    raw_df = generate_strict_synthetic_data()
    
    print(f"Extraction: Processing {len(raw_df)} raw logs into session features...")
    
    # 3. Feature Engineering (Aggregate by Session)
    features = []
    labels = []
    
    for session_id, group in raw_df.groupby('session_id'):
        # Extract 15-dim vector
        vec = extractor.extract_features(group)
        if vec is not None:
            features.append(vec)
            # Label is constant per session in this synthetic sets
            labels.append(group.iloc[0]['label'])
            
    X = np.array(features)
    y = np.array(labels)
    
    print(f"Dataset Shape: {X.shape}")
    feature_names = extractor.get_feature_names()
    
    # 4. Strict Label Mapping (Safe / Suspicious / Rogue)
    # Our generator already outputs Safe/Rogue. 
    # Let's map any 'Benign' to 'Safe' just in case.
    
    # 5. Preprocessing & Split
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Stratified Split to maintain class ratios
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, stratify=y, random_state=42
    )

    # 6. KNN Training (Supervised) with SMOTE & Tuning
    print("\n--- Training Supervised KNN (Industrial) ---")
    
    # Apply SMOTE to training data only
    smote = SMOTE(random_state=42)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)
    print(f"SMOTE Resampling: {len(y_train)} -> {len(y_train_resampled)} samples")
    
    knn_pipeline = KNeighborsClassifier()
    param_grid = {
        'n_neighbors': [3, 5, 7, 9, 11],
        'weights': ['uniform', 'distance'],
        'metric': ['euclidean', 'manhattan']
    }
    
    # Stratified K-Fold CV
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    grid = GridSearchCV(knn_pipeline, param_grid, cv=cv, scoring='f1_weighted', n_jobs=-1)
    grid.fit(X_train_resampled, y_train_resampled)
    
    best_knn = grid.best_estimator_
    print(f"Best KNN Params: {grid.best_params_}")
    
    # 7. Isolation Forest (Unsupervised / Benign-Only)
    print("\n--- Training Unsupervised Isolation Forest ---")
    
    # Filter ONLY 'Safe' data from training set
    X_train_safe = X_train[y_train == 'Safe']
    
    iso = IsolationForest(
        n_estimators=200, 
        contamination=0.05, # Expect 5% anomalies in wild
        random_state=42,
        n_jobs=-1
    )
    iso.fit(X_train_safe)
    
    # 8. Validation & Metrics
    print("\n--- Strict Validation ---")
    
    # KNN Metrics
    y_pred_knn = best_knn.predict(X_test)
    print("\n[KNN Classification Report]")
    print(classification_report(y_test, y_pred_knn))
    
    # IsoForest Metrics (ROC-AUC)
    # Map Labels: Safe=1, Rogue=-1 (IsoForest standard)
    y_test_binary = np.where(y_test == 'Safe', 1, -1)
    y_score_iso = iso.decision_function(X_test)
    auc = roc_auc_score(y_test_binary, y_score_iso)
    print(f"\n[Isolation Forest] ROC-AUC Score: {auc:.4f}")
    if auc < 0.8: print("⚠️ WARNING: Anomaly detection underperforming.")
    
    # 9. Artifact Export
    print("\n--- Exporting Artifacts ---")
    
    # Pickle (Python use)
    joblib.dump(best_knn, 'knn_model.pkl')
    joblib.dump(iso, 'isolation_forest.pkl')
    joblib.dump(scaler, 'scaler.pkl')
    
    # ONNX (Production use)
    initial_type = [('float_input', FloatTensorType([None, len(feature_names)]))]
    
    onx_knn = to_onnx(best_knn, X_train[:1].astype(np.float32), target_opset=12)
    with open("knn_model.onnx", "wb") as f:
        f.write(onx_knn.SerializeToString())
        
    try:
        onx_iso = to_onnx(iso, X_train[:1].astype(np.float32), target_opset=12)
        with open("isolation_forest.onnx", "wb") as f:
            f.write(onx_iso.SerializeToString())
    except:
        print("IsoForest ONNX export skipped (complex operator support).")

    # JSON Metadata
    meta = {
        'features': feature_names,
        'metrics': {
            'knn_best_params': grid.best_params_,
            'iso_auc': auc
        },
        'scaler_mean': scaler.mean_.tolist(),
        'scaler_scale': scaler.scale_.tolist()
    }
    with open('model_final_meta.json', 'w') as f:
        json.dump(meta, f, indent=2)
        
    print("DONE. Models ready for deployment.")

if __name__ == "__main__":
    train_industrial_pipeline()
