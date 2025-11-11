/**
 * Definitions des types utilisés dans Lockbox
 */

// Document chiffre stocher en base de données
export interface DocumentEntry  {
  id: number;               // Identifiant unique
  title: string;             // Titre pour la recherche)
  filename: string;          // Nom du fichier chiffré (f_<random>.enc)
  mime: string;              // Type MIME ( pour application/pdf, image/jpeg, etc.)
  nonce: string;             // Nonce/IV en base64 (unique par fichier)
  category?: string;         // Catégorie optionnelle (Personnel, Travail, etc.)
  created_at: number;        // Timestamp de création
  size: number;              // Taille du fichier original en bytes
}

// Parametres creation d'un nouveau document
export interface CreateDocumentParams {
  title: string;
  filename: string;
  mime: string;
  nonce: string;
  category?: string;
  size: number;
}


// Configuration de l'authentification
export interface AuthConfig {
  pinHash: string;             // Hash du PIN (bcrypt ou SHA-256)
  biometricEnabled: boolean;   // Biometrie active ou non
  autoLockMinutes: number;     // Minutes d'inactivite avant verrouillage (0 = désactivé)
}

// Resultat d'une op de chiffrement
export interface EncryptionResult {
  encryptedData: Uint8Array;   // Données chiffrées
  nonce: string;               // Nonce en base64
}

// Resultat d'import de fichier
export interface ImportResult {
  success: boolean;
  documentId?: number;
  error?: string;
}

// Informations sur un fichier a importer 
export interface FileToImport {
  uri: string;                 // URI du fichier
  name: string;                // Nom du fichier
  mimeType?: string;           // Type MIME
  size?: number;               // Taille en bytes
}

// Resultat dechiffrement tmp
export interface DecryptionResult {
  tempUri: string;             // URI du fichier temporaire déchiffré
  mimeType: string;            // Type MIME pour l'affichage
}


// structure d'export/backup
export interface BackupData {
  version: string;             // Version du format de backup
  timestamp: number;           // Date de création du backup
  entries: DocumentEntry[];    // Métadonnées des documents
  files: {
    filename: string;
    data: string;              // Données chiffrées en base64
  }[];
}

// Etat application 
export type AppLockState = 'locked' | 'unlocked' | 'first-launch';

// Catégories
export const DOCUMENT_CATEGORIES = [
  'Personnel',
  'Universitaire',
  'Travail',
  'Médical',
  'Financier',
  'Juridique',
  'Autre'
] as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];





