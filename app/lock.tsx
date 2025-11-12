import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
    authenticateWithBiometrics,
    createPin,
    getBiometricType,
    getLockState,
    isBiometricAvailable,
    isBiometricEnabled,
    unlockApp,
    verifyPin,
} from '../src/auth';

export default function LockScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isCreatingPin, setIsCreatingPin] = useState(false);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biométrie');

  useEffect(() => {
    checkLockState();
    checkBiometric();
  }, []);

  async function checkLockState() {
    const state = getLockState();
    if (state === 'first-launch') {
      setIsCreatingPin(true);
    }
  }

  async function checkBiometric() {
    const available = await isBiometricAvailable();
    const enabled = await isBiometricEnabled();
    const type = await getBiometricType();
    
    setBiometricAvailable(available && enabled);
    setBiometricType(type);
  }

  async function handlePinSubmit() {
    if (isCreatingPin) {
      // Mode création de PIN
      if (step === 'enter') {
        if (pin.length < 4 || pin.length > 6) {
          Alert.alert('Erreur', 'Le PIN doit contenir entre 4 et 6 chiffres');
          return;
        }
        setStep('confirm');
        setConfirmPin('');
      } else {
        // Confirmation du PIN
        if (pin !== confirmPin) {
          Alert.alert('Erreur', 'Les PINs ne correspondent pas');
          setPin('');
          setConfirmPin('');
          setStep('enter');
          return;
        }

        try {
          await createPin(pin);
          unlockApp();
          router.replace('/');
        } catch (error) {
          Alert.alert('Erreur', 'Impossible de créer le PIN');
          console.error(error);
        }
      }
    } else {
      // Mode déverrouillage
      try {
        const isValid = await verifyPin(pin);
        if (isValid) {
          unlockApp();
          router.replace('/');
        } else {
          Alert.alert('Erreur', 'PIN incorrect');
          setPin('');
        }
      } catch (error) {
        Alert.alert('Erreur', 'Erreur lors de la vérification du PIN');
        setPin('');
      }
    }
  }

  async function handleBiometric() {
    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        unlockApp();
        router.replace('/');
      }
    } catch (error) {
      console.error('Erreur biométrie:', error);
    }
  }

  function handlePinChange(value: string) {
    // Accepter uniquement les chiffres
    if (/^\d*$/.test(value)) {
      if (step === 'enter') {
        setPin(value);
      } else {
        setConfirmPin(value);
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>🔒</Text>
        <Text style={styles.title}>LockBox</Text>
        
        {isCreatingPin ? (
          <>
            <Text style={styles.subtitle}>
              {step === 'enter' 
                ? 'Créez votre PIN (4-6 chiffres)' 
                : 'Confirmez votre PIN'}
            </Text>
            <TextInput
              style={styles.input}
              value={step === 'enter' ? pin : confirmPin}
              onChangeText={handlePinChange}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor="#999"
              autoFocus
            />
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Entrez votre PIN</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={handlePinChange}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor="#999"
              autoFocus
            />
          </>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (step === 'enter' ? pin.length < 4 : confirmPin.length < 4) && styles.buttonDisabled
          ]}
          onPress={handlePinSubmit}
          disabled={step === 'enter' ? pin.length < 4 : confirmPin.length < 4}
        >
          <Text style={styles.buttonText}>
            {isCreatingPin 
              ? (step === 'enter' ? 'Continuer' : 'Créer le PIN')
              : 'Déverrouiller'}
          </Text>
        </TouchableOpacity>

        {!isCreatingPin && biometricAvailable && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometric}
          >
            <Text style={styles.biometricText}>
              Utiliser {biometricType}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '80%',
    maxWidth: 300,
    height: 60,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 20,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  biometricButton: {
    marginTop: 20,
    padding: 15,
  },
  biometricText: {
    color: '#007AFF',
    fontSize: 16,
  },
});