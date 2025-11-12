/**
 * Manipulation des fichiers chiffres.
 */


/* eslint-disable */
// @ts-nocheck

import * as FileSystem from 'expo-file-system/legacy';
import { decryptData, encryptData, generateEncryptedFilename } from './crypto';
import { DecryptionResult } from './types';


// Dossier de l'application  
const ENCRYPTED_DIR = `${FileSystem.documentDirectory}encrypted/`;
const TEMP_DIR = `${FileSystem.cacheDirectory}temp/`;

// Initialisation des dossiers nécessaires
export async function initFileSystem(): Promise<void> {
    try {

        // Dossier pour les fichiers chiffrés
        const encryptedDirInfo = await FileSystem.getInfoAsync(ENCRYPTED_DIR);
        if (!encryptedDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(ENCRYPTED_DIR, { intermediates: true });
            console.log(`Dossier encripter créé`);
        }

        // Dossier temporaire pour les opérations de chiffrement/déchiffrement
        const tempDirInfo = await FileSystem.getInfoAsync(TEMP_DIR);
        if (!tempDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(TEMP_DIR, { intermediates: true });
            console.log(`Dossier temporaire créé`);
        }

        // Nettoyer le dossier temporaire au démarrage
        await cleanTempFiles();
    } catch (error) {
        console.error('!! Erreur lors de l\'initialisation du système de fichiers :', error);
        throw error;
    }
}


// Lit un fichier et reourne son contenu chiffré en Uint8Array
export async function readFileAsBytes(uri: string): Promise<Uint8Array> {
    try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

        // Convertir Base64 en Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (error) {
        console.error('!! Erreur lors de la lecture du fichier :', error);
        throw error;
    }
}

// Ecrire des bytes dans un fichier
export async function writeBytesToFile(uri: string, data: Uint8Array): Promise<void> {
    try {
        // Convertir Uint8Array en Base64
        let binaryString = '';
        for (let i = 0; i < data.length; i++) {
            binaryString += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binaryString);

        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    } catch (error) {
        console.error('!! Erreur lors de l\'écriture du fichier :', error);
        throw error;
    }
}

// Chiffre un fichier et le sauvegarde dans le dossier encrypted
// en parametre : sourceUri : URI du fichier à chiffrer (selectuionné par l'utilisateur
// retourne -> nom du fichier chiffré, nonce)
export async function encryptAndSaveFile(sourceUri: string): Promise<{ filename: string; nonce: string; size: number }> {
    try {
        // Lire le fichier source
        const fileData = await readFileAsBytes(sourceUri);

        // Chiffrer les données
        const { encryptedData, nonce } = await encryptData(fileData);
        
        // Générer un nom de fichier unique pour le fichier chiffré
        const filename = generateEncryptedFilename();
        const targetUri = `${ENCRYPTED_DIR}${filename}`;

        // Sauvegarder le fichier chiffré
        await writeBytesToFile(targetUri, encryptedData);

        console.log(`Fichier chiffré sauvegardé : ${filename}`);
        return { filename, nonce, size: fileData.length };
    } catch (error) {
        console.error('!! Erreur lors du chiffrement et de la sauvegarde du fichier :', error);
        throw error;
    }
}

// Déchiffre un fichier chiffré et le sauvegarder tmporairement dans le cache 
// parametre : filename : nom du fichier chiffré à déchiffrer
//             nonce : nonce utilisé pour le chiffrement
//              mimeType : type MIME du fichier original
// retourne -> uri du fichier temporaire déchiffré
export async function decryptToTempFile(filename: string, nonce: string, mimeType: string): Promise<DecryptionResult> {
    try {
        // Lire le fichier chiffré
        const encryptedUri = `${ENCRYPTED_DIR}${filename}`;
        const encryptedData = await readFileAsBytes(encryptedUri);

        // Déchiffrer les données
        const decryptedData = await decryptData(encryptedData, nonce);

        // Determiner l'extension du fichier à partir du type MIME
        const extension = getExtensionFromMimeType(mimeType);
        const tempFilename = `temp_${Date.now()}${extension}`;
        const tempUri = `${TEMP_DIR}${tempFilename}`;

        // Sauvegarder le fichier déchiffré dans le dossier temporaire
        await writeBytesToFile(tempUri, decryptedData);

        console.log(`Fichier déchiffré sauvegardé temporairement : ${tempFilename}`);
        return { tempUri, mimeType };

    } catch (error) {
        console.error('!! Erreur lors du déchiffrement du fichier :', error);
        throw error;
    }
}

// Supprime un fichier chiffré au stockage
export async function deleteEncryptedFile(filename: string): Promise<void> {
    try {
        const uri = `${ENCRYPTED_DIR}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(uri);


        if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri);
            console.log(`Fichier chiffré supprimé : ${filename}`);
        }

    } catch (error) {
        console.error('!! Erreur lors de la suppression du fichier chiffré :', error);
        throw error;
    }

}

// Supprime un fichiers temporaires
export async function deleteTempFile(uri: string): Promise<void> {
    try {
        const fileInfo = await FileSystem.getInfoAsync(uri);

        if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri);
            console.log(`Fichiers temporaires supprimés`);
        }
    } catch (error) {
        console.error('!! Erreur lors de la suppression des fichiers temporaires :', error);
    }
}



// Nettoie tous les fichiers temporaires (appelé au démarrage de l'application)
export async function cleanTempFiles(): Promise<void> {
    try {
        const tempDirInfo = await FileSystem.getInfoAsync(TEMP_DIR);
        if (tempDirInfo.exists) {
            await FileSystem.deleteAsync(TEMP_DIR, { idempotent: true });
            await FileSystem.makeDirectoryAsync(TEMP_DIR, { intermediates: true });
            console.log(`Fichier temporaire nettoyé`);
        }
    } catch (error) {
        console.error('!! Erreur lors du nettoyage des fichiers temporaires :', error);
    }
}   


// recuperer la taille d'un fichier chiffré
export async function getEncryptedFileSize(filename: string): Promise<number> {
    try {
        const uri = `${ENCRYPTED_DIR}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(uri);

        if (fileInfo.exists && 'size' in fileInfo) {
            return fileInfo.size;
        }
        return 0;
    } catch (error) {
        console.error('!! Erreur lors de la récupération de la taille du fichier chiffré :', error);
        return 0;
    }
}

// Verifier si le fichier chiffré existe
export async function encryptedFileExists(filename: string): Promise<boolean> {
    try {
        const uri = `${ENCRYPTED_DIR}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(uri);
        return fileInfo.exists;
    } catch (error) {
        console.error('!! Erreur lors de la vérification de l\'existence du fichier chiffré :', error);
        return false;
    }
}


// Liste tous les fichiers chiffrés (pour debuger ou maintenance)
export async function listEncryptedFiles(): Promise<string[]> {
    try {
        const files = await FileSystem.readDirectoryAsync(ENCRYPTED_DIR);
        return files;
    } catch (error) {
        console.error('!! Erreur lors de la liste des fichiers chiffrés :', error);
        return [];    
    } 
}


// Determine l'extension de fichier à partir du type MIME
function getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
        'application/pdf': '.pdf',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'text/plain': '.txt',
        // Ajouter d'autres types MIME si nécessaire
    };
    return mimeMap[mimeType] || '.bin';
}


// Formate une taille en bytes en une chaîne lisible (Ko, Mo, Go)
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return `0 B`;

    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}