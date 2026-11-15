import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { LoginScreen } from '../screens/LoginScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { useAppDispatch } from '../redux/hooks';
import { clearError, loginUser, registerUser } from '../redux/slices/authSlice';

export type AuthScreenType = 'welcome' | 'signin' | 'signup';

export interface AuthNavigatorProps {
  initialScreen?: AuthScreenType;
  onAuthenticated?: () => void;
}

export const AuthNavigator: React.FC<AuthNavigatorProps> = ({
  initialScreen = 'welcome',
  onAuthenticated,
}) => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreenType>(initialScreen);
  const dispatch = useAppDispatch();

  const handleLogin = async (identifier: string, password: string) => {
    await dispatch(loginUser({ identifier, password })).unwrap();
    if (onAuthenticated) {
      onAuthenticated();
    }
  };

  const handleSignUp = async (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => {
    await dispatch(registerUser(payload)).unwrap();
    if (onAuthenticated) {
      onAuthenticated();
    }
  };

  const switchScreen = (screen: AuthScreenType) => {
    dispatch(clearError());
    setCurrentScreen(screen);
  };

  return (
    <View style={styles.container}>
      {currentScreen === 'welcome' && (
        <LoginScreen
          onLoginPress={() => switchScreen('signin')}
          onCreateAccountPress={() => switchScreen('signup')}
        />
      )}

      {currentScreen === 'signin' && (
        <SignInScreen
          onLoginSubmit={handleLogin}
          onNavigateToSignUp={() => switchScreen('signup')}
          onBack={() => switchScreen('welcome')}
        />
      )}

      {currentScreen === 'signup' && (
        <SignUpScreen
          onSignUpSubmit={handleSignUp}
          onNavigateToSignIn={() => switchScreen('signin')}
          onBack={() => switchScreen('welcome')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
  },
});

export default AuthNavigator;
