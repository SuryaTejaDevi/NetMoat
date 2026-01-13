import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Sun, Moon, Shield, Timer, Bell, Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useWiFiScan } from '@/contexts/WiFiScanContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot
} from '@/components/ui/input-otp';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, User } from 'lucide-react';

type SettingsTab = 'General' | 'Scanning' | 'Alerts' | 'Security';

export default function Settings() {
    const { settings, updateUserSettings } = useWiFiScan();
    const { user, updateEmailWithVerification } = useAuth();
    const { theme, setTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<SettingsTab>('General');
    const [localSettings, setLocalSettings] = useState(settings);
    const [hasChanges, setHasChanges] = useState(false);

    // Email Change State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [emailOtp, setEmailOtp] = useState('');
    const [expectedOtp, setExpectedOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Sync local state when context settings load
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const updateSetting = (key: string, value: any) => {
        setLocalSettings((prev: any) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const saveChanges = async () => {
        await updateUserSettings(localSettings);
        setHasChanges(false);
    };

    const handleEmailChangeRequest = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            return toast.error("Please enter a valid email address");
        }
        setIsEmailLoading(true);
        try {
            const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
            setExpectedOtp(mockCode);

            // In a real app, you'd trigger a server-side email send here
            toast.info("Verification Code Sent", {
                description: `Code: ${mockCode} (Simulated). Sent to ${newEmail}`,
            });

            setIsVerifying(true);
        } catch (err) {
            toast.error("Failed to initiate email change");
        } finally {
            setIsEmailLoading(false);
        }
    };

    const handleVerifyEmail = async () => {
        if (emailOtp.length < 6) return;
        setIsEmailLoading(true);
        try {
            await updateEmailWithVerification(newEmail, emailOtp, expectedOtp);
            toast.success("Email Updated Successfully");
            setIsEmailModalOpen(false);
            setIsVerifying(false);
            setNewEmail('');
            setEmailOtp('');
        } catch (error: any) {
            toast.error("Verification Failed", { description: error.message });
        } finally {
            setIsEmailLoading(false);
        }
    };

    const resetToDefaults = () => {
        const defaults = {
            scanInterval: 5,
            autoDisconnect: true,
            muteOnLogin: true,
            sensitivity: 'medium'
        };
        setLocalSettings(defaults);
        setHasChanges(true);
        toast.info('Settings reset to defaults');
    };

    const tabs: SettingsTab[] = ['General', 'Scanning', 'Alerts', 'Security'];

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <SettingsIcon className="h-6 w-6 text-primary" />
                        Settings
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Configure system preferences and security options</p>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="gap-2"
                    >
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" onClick={resetToDefaults}>
                        Reset to Defaults
                    </Button>
                    <Button onClick={saveChanges} disabled={!hasChanges} className="bg-primary hover:bg-primary/90">
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border tabs-container">
                <div className="flex gap-6 -mb-px overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                'pb-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                                activeTab === tab
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl space-y-6">
                {activeTab === 'General' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Account Information */}
                        <div className="card-stat">
                            <div className="flex items-center gap-2 mb-4">
                                <User className="h-4 w-4 text-primary" />
                                <h3 className="text-base font-semibold">Account Information</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 bg-muted/50 border border-border/50 rounded-xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registered Email</p>
                                        <p className="text-sm font-medium text-foreground">{user?.email || 'N/A'}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEmailModalOpen(true)}
                                        className="text-xs h-8"
                                    >
                                        Change Email
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Scan Interval */}
                        <div className="card-stat">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-status-info" />
                                    <h3 className="text-base font-semibold">Scan Interval</h3>
                                </div>
                                <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                    {localSettings.scanInterval}s
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Set the frequency of network discovery sweeps. Lower intervals provide real-time protection but may increase system load.
                            </p>
                            <div className="space-y-4">
                                <Slider
                                    value={[localSettings.scanInterval]}
                                    onValueChange={(value) => updateSetting('scanInterval', value[0])}
                                    min={1}
                                    max={60}
                                    step={1}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-[11px] uppercase tracking-wider font-bold text-muted-foreground/60">
                                    <span>Real-time (1s)</span>
                                    <span>Balanced (5s)</span>
                                    <span>Eco (60s)</span>
                                </div>
                            </div>
                        </div>

                        {/* Security Policies */}
                        <div className="card-stat">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="h-4 w-4 text-status-rogue" />
                                <h3 className="text-base font-semibold">Security Enforcement</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Define automatic reactive measures when threats are detected by the engine.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-muted/50 border border-border/50 rounded-xl">
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-sm text-foreground">Active Kill-Switch (Auto-Disconnect)</p>
                                        <p className="text-xs text-muted-foreground">Sever connection immediately if the associated AP is flagged as <span className="text-status-rogue font-semibold">Rogue</span>.</p>
                                    </div>
                                    <Switch
                                        checked={localSettings.autoDisconnect}
                                        onCheckedChange={(checked) => updateSetting('autoDisconnect', checked)}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-muted/50 border border-border/50 rounded-xl">
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-sm text-foreground">Distraction-Free Mode (Mute on Login)</p>
                                        <p className="text-xs text-muted-foreground">Suppress security alert toasts during the authentication flow.</p>
                                    </div>
                                    <Switch
                                        checked={localSettings.muteOnLogin}
                                        onCheckedChange={(checked) => updateSetting('muteOnLogin', checked)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Scanning' && (
                    <div className="card-stat animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <SettingsIcon className="h-4 w-4 text-primary" />
                            <h3 className="text-base font-semibold">Engine Configuration</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Configure low-level driver parameters and packet inspection depth. These settings are pre-optimized for standard Wi-Fi adapters.
                        </p>
                        <div className="mt-8 p-12 text-center border-2 border-dashed border-border rounded-xl">
                            <p className="text-sm text-muted-foreground">No advanced engine overrides required for current hardware.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'Alerts' && (
                    <div className="card-stat animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Bell className="h-4 w-4 text-status-suspicious" />
                            <h3 className="text-base font-semibold">Notification Channels</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Customize thresholds for visual and audible alerts.
                        </p>

                        <div className="space-y-3">
                            {[
                                { value: 'low', label: 'Conservative', description: 'Alert only on confirmed cryptographic failures.' },
                                { value: 'medium', label: 'Balanced (Default)', description: 'Alert on combined rule-based and ML anomalies.' },
                                { value: 'high', label: 'Paranoid', description: 'Alert on any suspicious metric fluctuation.' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => updateSetting('sensitivity', option.value)}
                                    className={cn(
                                        'w-full p-4 rounded-xl border text-left transition-all',
                                        localSettings.sensitivity === option.value
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                                            localSettings.sensitivity === option.value
                                                ? 'border-primary'
                                                : 'border-muted-foreground/30'
                                        )}>
                                            {localSettings.sensitivity === option.value && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-foreground">{option.label}</p>
                                            <p className="text-xs text-muted-foreground">{option.description}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'Security' && (
                    <div className="card-stat animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="text-base font-semibold mb-2">Advanced Security</h3>
                        <p className="text-sm text-muted-foreground mb-6">System integrity and access control settings.</p>
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/30 border border-border rounded-lg">
                                <p className="text-xs font-mono text-muted-foreground">ENGINE_STABILITY: VERIFIED</p>
                                <p className="text-xs font-mono text-muted-foreground">ML_MODEL_VERSION: 1.0.4-KNN-IF</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Email Change Dialog */}
            <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Mail className="h-5 w-5 text-blue-500" />
                            {isVerifying ? "Account Verification" : "Update Account Email"}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {isVerifying
                                ? "Enter the 6-digit code sent to your new email address."
                                : "Your email address is your primary identification. Changing it requires verification."}
                        </DialogDescription>
                    </DialogHeader>

                    {!isVerifying ? (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-email" className="text-zinc-300">New Email Address</Label>
                                <Input
                                    id="new-email"
                                    type="email"
                                    placeholder="new-email@netmoat.io"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                />
                            </div>
                            <Button
                                onClick={handleEmailChangeRequest}
                                disabled={isEmailLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 py-6 text-base font-bold"
                            >
                                {isEmailLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Send Verification Code"}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="flex justify-center flex-col items-center gap-4">
                                <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center w-full">Verification Code</Label>
                                <InputOTP maxLength={6} value={emailOtp} onChange={setEmailOtp}>
                                    <InputOTPGroup className="gap-2">
                                        {[0, 1, 2, 3, 4, 5].map(i => (
                                            <InputOTPSlot key={i} index={i} className="w-10 h-12 border-zinc-800 bg-zinc-900 text-lg text-blue-400 font-bold rounded-lg" />
                                        ))}
                                    </InputOTPGroup>
                                </InputOTP>
                            </div>

                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                                <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-1">Developer Sandbox: Active OTP</p>
                                <p className="text-xl font-mono font-bold text-white tracking-[0.3em]">{expectedOtp}</p>
                            </div>

                            <Button
                                onClick={handleVerifyEmail}
                                disabled={isEmailLoading || emailOtp.length < 6}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-6 text-base font-black uppercase"
                            >
                                {isEmailLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Verify & Update Email"}
                            </Button>

                            <button
                                onClick={() => setIsVerifying(false)}
                                className="text-xs text-zinc-500 hover:text-white mx-auto block"
                            >
                                Back to Edit Email
                            </button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
