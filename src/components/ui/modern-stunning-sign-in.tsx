import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { Shield, Mail, Phone, Lock, ArrowRight, Loader2, User, Key, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthStep = 'choice' | 'login' | 'signup' | 'verify' | 'forgot_password';

export const SignIn1 = () => {
    const { startRegistration, verifyAndCreate, login, forgotPassword } = useAuth();
    const navigate = useNavigate();

    // UI State
    const [step, setStep] = useState<AuthStep>('choice');
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Verification State
    const [emailOtp, setEmailOtp] = useState('');
    const [expectedEmailOtp, setExpectedEmailOtp] = useState('');

    // Handlers
    const handleSignupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return toast.error("Passwords do not match");
        }

        setIsLoading(true);
        try {
            // Generate Mock Email OTP
            const mockEmailCode = Math.floor(100000 + Math.random() * 900000).toString();
            setExpectedEmailOtp(mockEmailCode);

            // Format phone (minimal check)
            const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;

            // Start enrollment
            await startRegistration({
                name,
                email,
                phone: formattedPhone,
                password
            });

            // Call Backend to send REAL email (or log to console if not configured)
            try {
                await fetch('http://localhost:3001/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp: mockEmailCode, name })
                });
            } catch (err) {
                console.error("Failed to trigger email backend:", err);
            }

            setStep('verify');

            // SYSTEM TOAST: Notice that code was sent (SHOW CODE AS REQUESTED)
            toast.info("SECURITY ALERT: Verification Code Sent", {
                description: `Verification Code: ${mockEmailCode} (Simulated for testing). Real email attempt made to ${email}.`,
                duration: 15000,
            });

        } catch (error: any) {
            toast.error("Signup Failed", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (emailOtp.length < 6) return;

        setIsLoading(true);
        try {
            await verifyAndCreate(emailOtp, expectedEmailOtp);
            toast.success("Account Secured & Created!");
            navigate('/');
        } catch (error: any) {
            toast.error("Verification Failed", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
            toast.success("Welcome Back!");
            navigate('/');
        } catch (error: any) {
            toast.error("Login Failed", { description: "Invalid email or password" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await forgotPassword(email);
            if (result) {
                toast.success("Reset Code Sent", { description: `Check your email for code: ${result.otp}` });
                // In a real app, transition to a reset-password step
            } else {
                toast.error("Account Not Found");
            }
        } catch (err) {
            toast.error("Failed to process request");
        } finally {
            setIsLoading(false);
        }
    };

    // UI Variants
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-lg z-10"
            >
                <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-2xl shadow-2xl">
                    <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-3xl font-bold text-white tracking-tight">
                            {step === 'signup' ? 'Secure Enrollment' : step === 'login' ? 'Access Portal' : step === 'verify' ? 'Identity Verification' : 'NetMoat Protection'}
                        </CardTitle>
                        <CardDescription className="text-zinc-400 mt-2">
                            {step === 'choice' && "Professional grade Wi-Fi security for individuals & teams."}
                            {step === 'signup' && "Create your encrypted identity."}
                            {step === 'login' && "Enter credentials to resume monitoring."}
                            {step === 'verify' && "We've sent unique codes to your email and phone."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-8">
                        <AnimatePresence mode="wait">
                            {/* --- CHOICE STEP --- */}
                            {step === 'choice' && (
                                <motion.div key="choice" className="space-y-4 pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <Button onClick={() => setStep('signup')} className="w-full py-7 rounded-2xl bg-blue-600 hover:bg-blue-500 text-lg font-bold transition-all">
                                        Establish New Account <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                    <Button onClick={() => setStep('login')} variant="outline" className="w-full py-7 rounded-2xl border-zinc-700 hover:bg-zinc-800 text-lg font-semibold bg-transparent text-white">
                                        Sign In to Existing UID
                                    </Button>
                                </motion.div>
                            )}

                            {/* --- SIGNUP FORM --- */}
                            {step === 'signup' && (
                                <motion.form key="signup" onSubmit={handleSignupSubmit} className="space-y-4 pt-4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Full Name</Label>
                                            <div className="relative"><User className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input value={name} onChange={e => setName(e.target.value)} required placeholder="John Doe" className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Phone Number</Label>
                                            <div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+1 234 567 8900" className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400">Email Address</Label>
                                        <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="security@netmoat.io" className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Password</Label>
                                            <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Confirm</Label>
                                            <div className="relative"><Key className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                        </div>
                                    </div>
                                    <Button disabled={isLoading} className="w-full py-6 rounded-xl bg-blue-600 font-bold mt-4">
                                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Review & Verify"}
                                    </Button>
                                    <button type="button" onClick={() => setStep('choice')} className="text-zinc-500 text-xs flex items-center gap-1 mx-auto hover:text-white transition-colors"><ArrowLeft className="h-3 w-3" /> Back</button>
                                </motion.form>
                            )}

                            {/* --- LOGIN FORM --- */}
                            {step === 'login' && (
                                <motion.form key="login" onSubmit={handleLogin} className="space-y-5 pt-4" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400">Admin Email</Label>
                                        <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center"><Label className="text-zinc-400">Master Password</Label><button type="button" onClick={() => setStep('forgot_password')} className="text-xs text-blue-400 hover:text-blue-300">Forgot?</button></div>
                                        <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="pl-10 bg-zinc-950/50 border-zinc-800 text-white" /></div>
                                    </div>
                                    <Button disabled={isLoading} className="w-full py-6 rounded-xl bg-blue-600 font-bold text-lg">
                                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Sign In"}
                                    </Button>
                                    <button type="button" onClick={() => setStep('choice')} className="text-zinc-500 text-xs flex items-center gap-1 mx-auto hover:text-white transition-colors"><ArrowLeft className="h-3 w-3" /> Back</button>
                                </motion.form>
                            )}

                            {/* --- DUAL VERIFICATION --- */}
                            {step === 'verify' && (
                                <motion.form key="verify" onSubmit={handleVerification} className="space-y-8 pt-4" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                    <div className="space-y-4 text-center">
                                        <Label className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Email Verification Code</Label>
                                        <div className="flex justify-center">
                                            <InputOTP maxLength={6} value={emailOtp} onChange={setEmailOtp}>
                                                <InputOTPGroup className="gap-2">
                                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                                        <InputOTPSlot key={i} index={i} className="w-12 h-14 border-zinc-700 bg-zinc-950 text-xl text-blue-400 font-bold rounded-lg shadow-inner shadow-blue-500/10" />
                                                    ))}
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </div>



                                    {/* DEVELOPER OTP OVERLAY (As requested: "give the otp on screen") */}
                                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                                        <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-1">Developer Sandbox: Active OTP</p>
                                        <p className="text-2xl font-mono font-bold text-white tracking-[0.4em]">{expectedEmailOtp}</p>
                                    </div>

                                    <Button disabled={isLoading || emailOtp.length < 6} className="w-full py-7 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-xl font-black uppercase tracking-tighter">
                                        {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : "Finalize & Secure"}
                                    </Button>
                                </motion.form>
                            )}

                            {/* --- FORGOT PASSWORD --- */}
                            {step === 'forgot_password' && (
                                <motion.form key="forgot" onSubmit={handleForgotPassword} className="space-y-5 pt-4" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                    <div className="space-y-2 font-medium">
                                        <Label className="text-zinc-400">Account Email</Label>
                                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@example.com" className="bg-zinc-950/50 border-zinc-800 text-white" />
                                    </div>
                                    <Button disabled={isLoading} className="w-full py-5 rounded-xl bg-zinc-100 text-zinc-900 font-bold">
                                        Request Recovery
                                    </Button>
                                    <button type="button" onClick={() => setStep('login')} className="text-zinc-500 text-xs flex items-center gap-1 mx-auto hover:text-white transition-colors"><ArrowLeft className="h-3 w-3" /> Back to Login</button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </CardContent>

                    <CardFooter className="pt-0 pb-8 px-8 flex flex-col items-center">
                        <div className="h-px w-full bg-zinc-800 mb-6" />
                        <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest leading-relaxed">
                            Military-grade AES-256 Encryption active <br />
                            Protected by NetMoat Global Security Stack
                        </p>
                    </CardFooter>
                </Card>
            </motion.div>


        </div>
    );
};
