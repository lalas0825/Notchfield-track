import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * ErrorBoundary — catches unhandled JS errors in the component tree.
 * Shows a dark-mode fallback with a brand-orange retry button.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#0F172A',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <Text
            style={{
              color: '#F8FAFC',
              fontSize: 20,
              fontWeight: '700',
              marginBottom: 12,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: '#94A3B8',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 24,
              maxWidth: 300,
            }}
          >
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={{
              backgroundColor: '#F97316',
              borderRadius: 12,
              paddingHorizontal: 32,
              paddingVertical: 14,
              minHeight: 48,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
              Retry
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
