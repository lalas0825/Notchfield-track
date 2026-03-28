import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/auth-store';

type Mode = 'login' | 'forgot';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { signIn, resetPassword, loading } = useAuthStore();

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(result.error);
    }
    // On success, onAuthStateChange in the store handles navigation
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError('Enter your email address');
      return;
    }

    const result = await resetPassword(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Password reset email sent. Check your inbox.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo area */}
        <View className="mb-12 items-center">
          <Text className="text-4xl font-bold text-white">NotchField</Text>
          <Text className="mt-1 text-lg text-brand-orange">Track</Text>
        </View>

        {/* Title */}
        <Text className="mb-8 text-center text-2xl font-bold text-white">
          {mode === 'login' ? 'Sign In' : 'Reset Password'}
        </Text>

        {/* Error message */}
        {error && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base font-medium text-danger">
              {error}
            </Text>
          </View>
        )}

        {/* Success message */}
        {success && (
          <View className="mb-4 rounded-xl bg-green-500/10 px-4 py-3">
            <Text className="text-center text-base font-medium text-success">
              {success}
            </Text>
          </View>
        )}

        {/* Email input — 56dp height for field use */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-slate-400">
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#64748B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!loading}
            className="h-14 rounded-xl border border-border bg-card px-4 text-base text-white"
          />
        </View>

        {/* Password input — only in login mode */}
        {mode === 'login' && (
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-slate-400">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
              className="h-14 rounded-xl border border-border bg-card px-4 text-base text-white"
            />
          </View>
        )}

        {/* Primary action button — 56dp, brand orange */}
        <Pressable
          onPress={mode === 'login' ? handleLogin : handleForgotPassword}
          disabled={loading}
          className="mt-2 h-14 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-lg font-bold text-white">
              {mode === 'login' ? 'Sign In' : 'Send Reset Link'}
            </Text>
          )}
        </Pressable>

        {/* Toggle mode */}
        <Pressable
          onPress={() => {
            setMode(mode === 'login' ? 'forgot' : 'login');
            setError(null);
            setSuccess(null);
          }}
          className="mt-6 h-12 items-center justify-center"
        >
          <Text className="text-base text-slate-400">
            {mode === 'login'
              ? 'Forgot your password?'
              : 'Back to sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
