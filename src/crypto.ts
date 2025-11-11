import * as SecureStore from 'expo-secure-store';
import sodium from 'libsodium-wrappers';
import { EncryptionResult } from './types';

/**
 * Gestion de la clé maître et chiffrement/déchiffrement des fichiers
 */

// Cle stockage dans SecureStore
const MASTER_KEY_STORAGE = 'lockbox_master_key';

// Instance de la clé maître en mémoire(evite de relire dans SecureStore)
let masterKeyCache: Uint8Array | null = null;

// Initialiser libsodium (à appeler au démarrage de l'app)
export async function initCrypto(): Promise<void> {
    await sodium.ready;
    console.log('Libsodium initialisé et prêt !');
}


export async function ensureMasterKey(): Promise<Uint8Array> {
    // Si elle existe déjà en mémoire, la retourner
    if (masterKeyCache) {
        return masterKeyCache;
    }

    try {
        // Tenter de lire une clé existante dans SecureStore
        const storedKey = await SecureStore.getItemAsync(MASTER_KEY_STORAGE);

        if (storedKey) {
            masterKeyCache = sodium.from_base64(storedKey, sodium.base64_variants.ORIGINAL);
            console.log(' Clé maître chargée depuis SecureStore');
            return masterKeyCache!;
        }

        // Sinon, générer une nouvelle clé maître (32 octets aléatoires)
        const newKey = sodium.randombytes_buf(32);
        const b64Key = sodium.to_base64(newKey, sodium.base64_variants.ORIGINAL);

        // La stocker dans SecureStore
        await SecureStore.setItemAsync(MASTER_KEY_STORAGE, b64Key);

        masterKeyCache = newKey;
        console.log(' Nouvelle clé maître générée et stockée dans SecureStore');
        return masterKeyCache!;
    } catch (error) {
        console.error('!! Erreur lors de la gestion de la clé maître:', error);
        throw error;
    }
}


// Chiffrer des données avec XChaCha20-Poly1305 (AEAD)
export async function encryptData(data: Uint8Array): Promise<EncryptionResult> {
    await sodium.ready;
    const masterKey = await ensureMasterKey();

    try {
        // Générer un nonce unique (24 octets pour XChaCha20)
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

        // Chiffrer les données AEAD
        const encryptedData = sodium.crypto_secretbox_easy(
            data,
            nonce,
            masterKey
        );

        // Convertir le nonce en base64 pour le stockage en base de données
        const nonceBase64 = sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL);

        console.log(' Données chiffrées avec succès');
        return {
            encryptedData,
            nonce: nonceBase64
        };
    } catch (error) {
        console.error('!! Erreur lors du chiffrement des données:', error);
        throw error;
    }
}


// Déchiffrer des données avec XChaCha20-Poly1305 (AEAD)
export async function decryptData(encryptedData: Uint8Array, nonceBase64: string): Promise<Uint8Array> {
    await sodium.ready;
    const masterKey = await ensureMasterKey();

    try {
        // Convertir le nonce de base64 en Uint8Array
        const nonce = sodium.from_base64(nonceBase64, sodium.base64_variants.ORIGINAL);

        // Déchiffrer les données
        const decryptedData = sodium.crypto_secretbox_open_easy(
            encryptedData,
            nonce,
            masterKey
        );
        console.log(' Données déchiffrées avec succès');
        return decryptedData;
    } catch (error) {
        console.error('!! Erreur lors du déchiffrement des données:', error);
        throw error;
    }
}


// Efface la cle maitre du cache (Apres un verrouillage de l'app)
export function clearMasterKeyCache(): void {
    masterKeyCache = null;
    console.log(' Clé maître effacée du cache mémoire');
}


// Supprime difinitivement la clé maître de SecureStore
// (Réinitialisation complète tout les documents seront inaccessibles)
export async function deleteMasterKey(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(MASTER_KEY_STORAGE);
        masterKeyCache = null;
        console.log(' Clé maître supprimée de SecureStore');
    } catch (error) {
        console.error('!! Erreur lors de la suppression de la clé maître:', error);
        throw error;
    }
}


// Verifier si la clé maître existe dans SecureStore
export async function hasMasterKey(): Promise<boolean> {
    try {
        const storedKey = await SecureStore.getItemAsync(MASTER_KEY_STORAGE);
        return storedKey !== null;
    } catch (error) {
        console.error('!! Erreur lors de la vérification de la clé maître:', error);
        return false;
    }
}   


// Generer un nom fichier chiffré unique aleatoire
// Format : f_<random>.enc
export function generateEncryptedFilename(): string {
    const randomBytes = sodium.randombytes_buf(16);
    const randomHex = sodium.to_hex(randomBytes);
    return `f_${randomHex}.enc`;
}


// Hash un PIN avec SHA-256
// Pour production, utiliser bcrypt ou Argon2
export async function hashPassword(password: string): Promise<string> {
    await sodium.ready;
    const hash = sodium.crypto_generichash(32, sodium.from_string(password));
    return sodium.to_base64(hash, sodium.base64_variants.ORIGINAL);
}

// Verifier si un mot de passe (pin) correspond au hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const inputHash = await hashPassword(password);
    return inputHash === hash;
}