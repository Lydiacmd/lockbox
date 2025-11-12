import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { hasPin, setLockState } from '../src/auth';
import { initCrypto } from '../src/crypto';
import { initDatabase } from '../src/db';
import { initFileSystem } from '../src/files';
import { AppLockState } from '../src/types';


export default function RootLayout() {  
    const [isInitialized, setIsInitialized] = useState(false);
    const [lockState, setLockStateLocal] = useState<AppLockState>('locked');

    useEffect(() => {
        initApp();
    }, []);

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
                <ActivityIndicator size="large" />
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