/**
 * Gestion du PIN, biométrie et auto-lock
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { hashPassword, verifyPassword } from './crypto';
import { AppLockState, AuthConfig } from './types';

// Système de notification pour les changements de lockState
type LockStateListener = (state: AppLockState) => void;
let lockStateListeners: LockStateListener[] = [];

// Fonction pour s'abonner aux changements de lockState
export function subscribeLockState(listener: LockStateListener): () => void {
    lockStateListeners.push(listener);
    // Retourner une fonction pour se désabonner
    return () => {
        lockStateListeners = lockStateListeners.filter(l => l !== listener);
    };
}

// Fonction pour notifier tous les listeners
function notifyLockStateChange(state: AppLockState): void {
    lockStateListeners.forEach(listener => listener(state));
}

// Clés de stockage
const PIN_HASH_KEY = 'lockbox_pin_hash';
const BIOMETRIC_ENABLED_KEY = 'lockbox_biometric_enabled';
const AUTO_LOCK_MINUTES_KEY = 'lockbox_autolock_minutes';

// État de verrouillage en mémoire
let currentLockState: AppLockState = 'locked';
let lastActivityTime: number = Date.now();
let autoLockTimer: ReturnType<typeof setInterval> | null = null;

// Verifie si Pin existe
export async function hasPin(): Promise<boolean> {
    try {
        const pinHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
        return pinHash !== null;
    } catch (error) {
        console.error('Erreur lors de la vérification du PIN :', error);
        return false;
    }
}

// Cree un nouveau PIN (1er utilisation)
export async function createPin(pin: string): Promise<void> {
    if (pin.length < 4 || pin.length > 6) {
        throw new Error('Le PIN doit contenir entre 4 et 6 chiffres.');
    }
    if (!/^\d+$/.test(pin)) {
        throw new Error('Le PIN doit contenir uniquement des chiffres.');
    }
    try {
        const hash = await hashPassword(pin);
        await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
        console.log('✅ Nouveau PIN créé et stocké.');
    } catch (error) {
        console.error('!! Erreur lors de la création du PIN :', error);
        throw error;
    }
}

// Verifie un PIN est correct
export async function verifyPin(pin: string): Promise<boolean> {
    try {
        const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
        if (!storedHash) {
            throw new Error('Aucun PIN n\'est défini.');
        }
        const isValid = await verifyPassword(pin, storedHash);

        if (isValid) {
            console.log('✅ PIN Correct.');
            currentLockState = 'unlocked';
            notifyLockStateChange('unlocked');
            updateActivity();
        } else {
            console.log('❌ PIN Incorrect.');
        }
        return isValid;
    } catch (error) {
        console.error('!! Erreur lors de la vérification du PIN :', error);
        throw error;
    }
}

// Change le PIN actuel (necessite l'ancien PIN)
export async function changePin(oldPin: string, newPin: string): Promise<void> {
    const isOldPinValid = await verifyPin(oldPin);
    if (!isOldPinValid) {
        throw new Error('L\'ancien PIN est incorrect.');
    }
    await createPin(newPin);
    console.log('✅ PIN changé avec succès.');
}

// Verifie si la biometrie est disponible sur l'appareil
export async function isBiometricAvailable(): Promise<boolean> {
    try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    } catch (error) {
        console.error('!! Erreur lors de la vérification de la biométrie :', error);
        return false;
    }
}

// recupere le type de biometrie disponible
export async function getBiometricType(): Promise<string> {
    try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            return 'Empreinte digitale';
        }
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            return 'Face ID';
        }
        if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            return 'Iris';
        }
        return 'Biometrie';
    } catch (error) {
        console.error('!! Erreur lors de la récupération du type de biométrie :', error);
        return 'Biometrie';
    }
}

// active ou desactive la biometrie
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
        console.log(`✅ Biométrie ${enabled ? 'activée' : 'désactivée'}.`);
    } catch (error) {
        console.error('!! Erreur lors de la configuration de la biométrie :', error);
        throw error;
    }
}

// verifie si la biometrie est activée
export async function isBiometricEnabled(): Promise<boolean> {
    try {
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        return enabled === 'true';
    } catch (error) {
        console.error('!! Erreur lors de la vérification de la biométrie :', error);
        return false;
    }
}

// Authentifie via biometrie
export async function authenticateWithBiometrics(): Promise<boolean> {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Deverrouiller Lockbox',
            cancelLabel: 'Annuler',
            fallbackLabel: 'Utiliser le PIN',
            disableDeviceFallback: false,
        });

        if (result.success) {
            console.log('✅ Authentification biométrique réussie.');
            currentLockState = 'unlocked';
            notifyLockStateChange('unlocked');
            updateActivity();
            return true;
        } else {
            console.log('❌ Authentification biométrique échouée ou annulée.');
            return false;
        }
    } catch (error) {
        console.error('!! Erreur lors de l\'authentification biométrique :', error);
        return false;
    }
}

// Configure le delai d'auto-lock (min)
export async function setAutoLockMinutes(minutes: number): Promise<void> {
    try {
        await SecureStore.setItemAsync(AUTO_LOCK_MINUTES_KEY, minutes.toString());
        console.log(`✅ Auto-lock configuré à ${minutes} minute(s).`);

        if (currentLockState === 'unlocked') {
            startAutoLockTimer();
        }
    } catch (error) {
        console.error('!! Erreur lors de la configuration de l\'auto-lock :', error);
        throw error;
    }
}

// recupere le delai d'auto-lock (min)
export async function getAutoLockMinutes(): Promise<number> {
    try {
        const minutes = await SecureStore.getItemAsync(AUTO_LOCK_MINUTES_KEY);
        return minutes ? parseInt(minutes, 10) : 5; // defaut 5 min
    } catch (error) {
        console.error('!! Erreur lors de la récupération de l\'auto-lock :', error);
        return 5;
    }
}

// Met a jour le temps de derniere activite
export function updateActivity(): void {
    lastActivityTime = Date.now();
}

// Demarre le timer d'auto-lock
export async function startAutoLockTimer(): Promise<void> {
    // efface l'ancien timer
    if (autoLockTimer) {
        clearInterval(autoLockTimer);
    }

    const autoLockMinutes = await getAutoLockMinutes();

    if (autoLockMinutes === 0) {
        console.log('⏸️ Auto-lock désactivé.');
        return; // auto-lock désactivé
    }

    // verifie toutes les 10 secondes
    autoLockTimer = setInterval(() => {
        const now = Date.now();
        const inactiveMinutes = (now - lastActivityTime) / 1000 / 60;

        if (inactiveMinutes >= autoLockMinutes) {
            lockApp();
        }
    }, 10000); // 10 s

    console.log(`⏰ Timer d'auto-lock démarré pour ${autoLockMinutes} minute(s) d'inactivité.`);
}

// Arrete le timer d'auto-lock
export function stopAutoLockTimer(): void {
    if (autoLockTimer) {
        clearInterval(autoLockTimer);
        autoLockTimer = null;
        console.log('⏹️ Timer d\'auto-lock arrêté.');
    }
}

// Verrouille l'application
export function lockApp(): void {
    currentLockState = 'locked';
    notifyLockStateChange('locked');
    stopAutoLockTimer();
    console.log('🔒 Application verrouillée automatiquement.');
}

// Deverrouille l'application
export function unlockApp(): void {
    currentLockState = 'unlocked';
    notifyLockStateChange('unlocked');
    updateActivity();
    startAutoLockTimer();
    console.log('🔓 Application déverrouillée.');
}

// Recupere l'etat de verrouillage actuel
export function getLockState(): AppLockState {
    return currentLockState;
}

// definit etat de verrouillage
export function setLockState(state: AppLockState): void {
    currentLockState = state;
    notifyLockStateChange(state);
}

// Recupere la configuration complete d'authentification
export async function getAuthConfig(): Promise<AuthConfig> {
    try {
        const pinHash = (await SecureStore.getItemAsync(PIN_HASH_KEY)) || '';
        const biometricEnabled = await isBiometricEnabled();
        const autoLockMinutes = await getAutoLockMinutes();

        return {
            pinHash,
            biometricEnabled,
            autoLockMinutes,
        };
    } catch (error) {
        console.error('!! Erreur lors de la récupération de la configuration d\'authentification :', error);
        throw error;
    }
}

// Reinitialise toute l'authentification (suppression PIN, biometrie, auto-lock) (test/debug)
export async function resetAuth(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(PIN_HASH_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
        await SecureStore.deleteItemAsync(AUTO_LOCK_MINUTES_KEY);
        stopAutoLockTimer();
        currentLockState = 'first-launch';
        notifyLockStateChange('first-launch');
        console.log('🔄 Configuration d\'authentification réinitialisée.');
    } catch (error) {
        console.error('!! Erreur lors de la réinitialisation de l\'authentification :', error);
        throw error;
    }
}