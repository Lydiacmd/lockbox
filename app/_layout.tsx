import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-get-random-values';
import { hasPin, setLockState, subscribeLockState } from '../src/auth';
import { initCrypto } from '../src/crypto';
import { initDatabase } from '../src/db';
import { initFileSystem } from '../src/files';
import { AppLockState } from '../src/types';

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const [isInitialized, setIsInitialized] = useState(false);
    const [lockState, setLockStateLocal] = useState<AppLockState>('locked');

    useEffect(() => {
        initApp();
    }, []);

    // S'abonner aux changements du lockState global
    useEffect(() => {
        const unsubscribe = subscribeLockState((newState) => {
            console.log(`📱 État de verrouillage changé : ${newState}`);
            setLockStateLocal(newState);
        });

        // Se désabonner au démontage
        return unsubscribe;
    }, []);

    // Gérer la navigation en fonction du lockState
    useEffect(() => {
        if (!isInitialized) return;

        const inAuthGroup = segments[0] === 'lock';

        if (lockState === 'unlocked' && inAuthGroup) {
            // Si déverrouillé et sur l'écran lock, aller à l'index
            console.log('🔓 Navigation vers la liste des documents');
            router.replace('/');
        } else if (lockState !== 'unlocked' && !inAuthGroup) {
            // Si verrouillé et pas sur l'écran lock, aller au lock
            console.log('🔒 Navigation vers l\'écran de verrouillage');
            router.replace('/lock');
        }
    }, [isInitialized, lockState, segments]);

    async function initApp() {
        try {
            // Initialiser le système de fichiers, la BD et la crypto
            await initDatabase();
            await initCrypto();
            await initFileSystem();

            // verifier si le pin est défini
            const pinExists = await hasPin();
            if (!pinExists) {
                // 1ere utilisation
                setLockState('first-launch');
                setLockStateLocal('first-launch');
            } else {
                // verifier Pin existant, app verrouillée
                setLockState('locked');
                setLockStateLocal('locked');
            }

            setIsInitialized(true);
        } catch (error) {
            console.error('!! Erreur lors de l\'initialisation de l\'application :', error);
        }
    }

    // Afficher un loader pendant l'initialisation
    if (!isInitialized) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#007AFF',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen
                name="lock"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="index"
                options={{
                    title: 'Mes Documents',
                    headerLeft: () => null,
                }}
            />
            <Stack.Screen
                name="import"
                options={{
                    title: 'Importer un document',
                    presentation: 'modal',
                }}
            />
            <Stack.Screen
                name="view"
                options={{
                    title: 'Document',
                }}
            />
            <Stack.Screen
                name="settings"
                options={{
                    title: 'Paramètres',
                    presentation: 'modal',
                }}
            />
        </Stack>
    );
}