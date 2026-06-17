import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
  Animated, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useStaggerEntrance, useFieldShake, useSuccessBurst } from '../hooks/useAnimations';
import { useSound } from '../context/SoundContext';
import { Springs } from '../constants/motion';
import { AuthBackground } from '../components/AuthBackground';

function FocusInput({
  icon, placeholder, value, onChangeText, keyboardType,
  autoCapitalize, secureTextEntry, rightElement,
  returnKeyType, onSubmitEditing, inputRef,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.accent],
  });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <Ionicons
        name={icon as any}
        size={18}
        color={focused ? Colors.accent : Colors.textMuted}
        style={styles.inputIcon}
      />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textHint}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {rightElement}
    </Animated.View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { promptAsync, loading: googleLoading, disabled: googleDisabled } = useGoogleAuth();
  const { play } = useSound();

  const panelY  = useSharedValue(80);
  const panelOp = useSharedValue(0);

  useEffect(() => {
    panelY.value  = withSpring(0, Springs.bouncy);
    panelOp.value = withTiming(1, { duration: 300 });
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelY.value }],
    opacity: panelOp.value,
  }));

  const field0Style = useStaggerEntrance(0, 200);
  const field1Style = useStaggerEntrance(1, 200);
  const field2Style = useStaggerEntrance(2, 200);
  const btnStyle    = useStaggerEntrance(3, 200);

  const { animatedStyle: shakeStyle, shake } = useFieldShake();
  const { trigger: triggerBurst, dotStyles }  = useSuccessBurst();

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (!username.trim())   { Alert.alert('Required', 'Please enter a username.'); }
      else if (!email.trim()) { Alert.alert('Required', 'Please enter your email.'); }
      else                    { Alert.alert('Required', 'Please enter a password.'); }
      return;
    }
    if (password.length < 6) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res  = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.success) {
        Alert.alert('Registration failed', data.message);
        return;
      }
      await login(data.token, data.user);
      play('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerBurst(() => {
        router.replace('/onboarding');
      });
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={{ flex: 1 }}>
        <AuthBackground />

        {/* Back button — fixed, outside ScrollView so it doesn't scroll */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textSub} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>
              <View style={{ flex: 1 }} />

              <ReAnimated.View style={[styles.panel, panelStyle]}>
                {/* Google */}
                <TouchableOpacity
                  style={[styles.googleBtn, googleDisabled && { opacity: 0.6 }]}
                  onPress={() => promptAsync()}
                  activeOpacity={0.85}
                  disabled={googleDisabled}
                >
                  {googleLoading
                    ? <ActivityIndicator size="small" color="#DB4437" />
                    : <>
                        <Ionicons name="logo-google" size={19} color="#DB4437" />
                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                      </>}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or sign up with email</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Username */}
                <ReAnimated.View style={field0Style}>
                  <FocusInput
                    icon="person-outline"
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </ReAnimated.View>

                {/* Email */}
                <ReAnimated.View style={field1Style}>
                  <FocusInput
                    icon="mail-outline"
                    placeholder="Email address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    inputRef={emailRef}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </ReAnimated.View>

                {/* Password */}
                <ReAnimated.View style={field2Style}>
                  <FocusInput
                    icon="lock-closed-outline"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    inputRef={passwordRef}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                    rightElement={
                      <TouchableOpacity
                        onPress={() => setShowPw(v => !v)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showPw ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={Colors.textMuted}
                        />
                      </TouchableOpacity>
                    }
                  />
                </ReAnimated.View>

                {/* CTA */}
                <ReAnimated.View style={[btnStyle, shakeStyle]}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && { opacity: 0.75 }]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color={Colors.bg} size="small" />
                      : <>
                          <Text style={styles.primaryBtnText}>Create Account</Text>
                          <Ionicons name="arrow-forward-circle" size={20} color={Colors.bg} />
                        </>}
                  </TouchableOpacity>
                </ReAnimated.View>

                {/* Success burst dots */}
                {dotStyles.map((dotStyle, i) => (
                  <ReAnimated.View
                    key={i}
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: Colors.accent,
                        alignSelf: 'center',
                      },
                      dotStyle,
                    ]}
                  />
                ))}

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Sign in →</Text>
                  </TouchableOpacity>
                </View>
              </ReAnimated.View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  backBtn: {
    position: 'absolute',
    top: 56, left: Spacing.xl,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },

  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 14,
  },

  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: Radius.lg, height: 52, gap: 10, paddingHorizontal: 16 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg, height: 52,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, color: Colors.text, fontSize: 15 },
  eyeBtn:    { padding: 4 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, height: 54, borderRadius: Radius.pill,
    marginTop: 2,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  primaryBtnText: { color: Colors.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  footer:     { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  footerText: { color: Colors.textMuted, fontSize: 15 },
  footerLink: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
});
