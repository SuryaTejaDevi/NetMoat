import numpy as np
import pandas as pd
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib
import json
import os

# --- 1. DATA GENERATION (MIMIC AWID & CRAWDAD) ---
def generate_synthetic_data(n_samples=2000):
    np.random.seed(42)
    
    # Features: rssi, rssi_std, enc, ssid_sim, bssid_uniq, chan_stab, rssi_var, dist_dev, chan_switch
    # enc: 0=open, 1=wep, 3=wpa, 4=wpa2, 5=wpa3
    
    # SAFE (Benign)
    safe_data = pd.DataFrame({
        'rssi': np.random.normal(-65, 5, n_samples // 2),
        'rssi_std': np.random.normal(1.5, 0.5, n_samples // 2),
        'enc': np.random.choice([4, 5], n_samples // 2),
        'ssid_sim': np.random.uniform(0, 0.2, n_samples // 2),
        'bssid_uniq': np.zeros(n_samples // 2),
        'chan_stab': np.random.uniform(0.8, 1.0, n_samples // 2),
        'rssi_var': np.random.normal(5, 2, n_samples // 2),
        'dist_dev': np.random.normal(0.2, 0.1, n_samples // 2),
        'chan_switch': np.zeros(n_samples // 2),
        'label': 'Safe'
    })

    # SUSPICIOUS (Anomalous but not necessarily Rogue)
    suspicious_data = pd.DataFrame({
        'rssi': np.random.normal(-50, 8, n_samples // 4),
        'rssi_std': np.random.normal(8, 3, n_samples // 4),
        'enc': np.random.choice([0, 1, 3, 4], n_samples // 4),
        'ssid_sim': np.random.uniform(0.3, 0.6, n_samples // 4),
        'bssid_uniq': np.random.choice([0, 1], n_samples // 4),
        'chan_stab': np.random.uniform(0.3, 0.7, n_samples // 4),
        'rssi_var': np.random.normal(15, 5, n_samples // 4),
        'dist_dev': np.random.normal(0.6, 0.3, n_samples // 4),
        'chan_switch': np.random.randint(1, 3, n_samples // 4),
        'label': 'Suspicious'
    })

    # ROGUE (Attacks/Evil Twin)
    rogue_data = pd.DataFrame({
        'rssi': np.random.normal(-35, 5, n_samples // 4),
        'rssi_std': np.random.normal(15, 5, n_samples // 4),
        'enc': np.random.choice([0, 1, 4], n_samples // 4),
        'ssid_sim': np.random.uniform(0.8, 1.0, n_samples // 4),
        'bssid_uniq': np.ones(n_samples // 4),
        'chan_stab': np.random.uniform(0.0, 0.4, n_samples // 4),
        'rssi_var': np.random.normal(25, 10, n_samples // 4),
        'dist_dev': np.random.normal(1.2, 0.5, n_samples // 4),
        'chan_switch': np.random.randint(2, 5, n_samples // 4),
        'label': 'Rogue'
    })

    df = pd.concat([safe_data, suspicious_data, rogue_data], ignore_index=True)
    return df

# --- 2. TRAINING ---
def train_models():
    print("Generating synthetic dataset...")
    df = generate_synthetic_data()
    X = df.drop(columns=['label'])
    y = df['label']

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, stratify=y, random_state=42)

    # A. KNN (Supervised)
    print("Training KNN Classifier...")
    knn = KNeighborsClassifier()
    # Fine tune K
    param_grid = {'n_neighbors': [3, 5, 7, 9, 11]}
    grid_search = GridSearchCV(knn, param_grid, cv=5)
    grid_search.fit(X_train, y_train)
    best_knn = grid_search.best_estimator_
    
    # B. Isolation Forest (Unsupervised)
    print("Training Isolation Forest on benign data...")
    # Train ONLY on 'Safe' instances
    X_benign = X_train[y_train == 'Safe']
    iso_forest = IsolationForest(contamination=0.05, random_state=42)
    iso_forest.fit(X_benign)

    # --- 3. EVALUATION ---
    print("\nEvaluating Models...")
    y_pred = best_knn.predict(X_test)
    report = classification_report(y_test, y_pred, output_dict=True)
    conf_matrix = confusion_matrix(y_test, y_pred)
    
    # IF Evaluation (Anomalies should be Suspicious/Rogue)
    y_test_anomaly = y_test.apply(lambda x: -1 if x != 'Safe' else 1)
    if_scores = iso_forest.decision_function(X_test)
    if_auc = roc_auc_score(y_test_anomaly, if_scores)

    # --- 4. EXPORT ---
    print("\nExporting Model Artifacts...")
    joblib.dump(best_knn, 'knn_model.pkl')
    joblib.dump(iso_forest, 'isolation_forest.pkl')
    joblib.dump(scaler, 'scaler.pkl')

    # Export centroids for JS inference (Path 3 Corroboration)
    centroids = df.groupby('label').mean().to_dict('index')
    with open('model_params.json', 'w') as f:
        json.dump({
            'centroids': centroids,
            'scaler_mean': scaler.mean_.tolist(),
            'scaler_scale': scaler.scale_.tolist(),
            'best_k': grid_search.best_params_['n_neighbors'],
            'metrics': {
                'knn_accuracy': report['accuracy'],
                'knn_f1_weighted': report['weighted avg']['f1-score'],
                'if_auc': if_auc
            }
        }, f, indent=2)

    print("Success. Saved pkl and json artifacts.")
    return report, if_auc

if __name__ == "__main__":
    train_models()
