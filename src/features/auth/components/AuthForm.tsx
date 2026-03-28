import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth-store';

type Mode = 'login' | 'forgot';

export function AuthForm() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { signIn, resetPassword, loading } = useAuthStore();

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError(t('auth.email_required'));
      return;
    }
    const result = await signIn(email.trim(), password);
    if (result.error) setError(result.error);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError(t('auth.enter_email'));
      return;
    }
    const result = await resetPassword(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(t('auth.reset_email_sent'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-8">
        <View className="mb-12 items-center">
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: 280, height: 100 }}
            resizeMode="contain"
          />
        </View>

        <Text className="mb-8 text-center text-2xl font-bold text-white">
          {mode === 'login' ? t('auth.sign_in') : t('auth.reset_password')}
        </Text>

        {error && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base font-medium text-danger">{error}</Text>
          </View>
        )}

        {success && (
          <View className="mb-4 rounded-xl bg-green-500/10 px-4 py-3">
            <Text className="text-center text-base font-medium text-success">{success}</Text>
          </View>
        )}

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-slate-400">{t('auth.email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email_placeholder')}
            placeholderTextColor="#64748B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!loading}
            className="h-14 rounded-xl border border-border bg-card px-4 text-base text-white"
          />
        </View>

        {mode === 'login' && (
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-slate-400">{t('auth.password')}</Text>
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

        <Pressable
          onPress={mode === 'login' ? handleLogin : handleForgotPassword}
          disabled={loading}
          className="mt-2 h-14 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-lg font-bold text-white">
              {mode === 'login' ? t('auth.sign_in') : t('auth.send_reset_link')}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === 'login' ? 'forgot' : 'login');
            setError(null);
            setSuccess(null);
          }}
          className="mt-6 h-12 items-center justify-center"
        >
          <Text className="text-base text-slate-400">
            {mode === 'login' ? t('auth.forgot_password') : t('auth.back_to_sign_in')}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
