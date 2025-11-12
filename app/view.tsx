import * as IntentLauncher from 'expo-intent-launcher';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDocumentById } from '../src/db';
import { decryptToTempFile, deleteTempFile, formatFileSize } from '../src/files';
import { DocumentEntry } from '../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ViewScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const [document, setDocument] = useState<DocumentEntry | null>(null);
    const [tempUri, setTempUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        loadDocument();

        // Nettoyer le fichier temporaire au démontage
        return () => {
            if (tempUri) {
                deleteTempFile(tempUri);
            }
        };
    }, []);

    async function loadDocument() {
        try {
            const id = parseInt(params.id as string);
            if (isNaN(id)) {
                Alert.alert('Erreur', 'ID de document invalide');
                router.back();
                return;
            }

            // Charger les métadonnées
            const doc = await getDocumentById(id);
            if (!doc) {
                Alert.alert('Erreur', 'Document introuvable');
                router.back();
                return;
            }

            setDocument(doc);

            // Déchiffrer le fichier
            const { tempUri: decryptedUri } = await decryptToTempFile(
                doc.filename,
                doc.nonce,
                doc.mime
            );
            
            console.log('📁 Fichier déchiffré:', decryptedUri);
            setTempUri(decryptedUri);
        } catch (error) {
            console.error('Erreur chargement document:', error);
            Alert.alert('Erreur', 'Impossible de charger le document');
            router.back();
        } finally {
            setIsLoading(false);
        }
    }

    // Ouvrir le fichier directement dans l'application par défaut
    async function handleOpen() {
        if (!tempUri || !document) return;

        setIsOpening(true);
        try {
            if (Platform.OS === 'android') {
                // Sur Android, utiliser IntentLauncher pour ouvrir directement
                const contentUri = await IntentLauncher.getContentProviderUriForFileAsync(tempUri);
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                    data: contentUri,
                    flags: 1,
                    type: document.mime,
                });
            } else {
                // Sur iOS, utiliser Sharing avec une seule option pour forcer l'ouverture
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(tempUri, {
                        mimeType: document.mime,
                        dialogTitle: document.title,
                    });
                } else {
                    Alert.alert('Erreur', 'Impossible d\'ouvrir ce fichier');
                }
            }
        } catch (error) {
            console.error('Erreur ouverture:', error);
            Alert.alert(
                'Erreur',
                'Impossible d\'ouvrir le fichier. Utilisez le bouton "Partager" pour sélectionner une application.'
            );
        } finally {
            setIsOpening(false);
        }
    }

    // Partager le fichier déchiffré
    async function handleShare() {
        if (!tempUri || !document) return;

        setIsSharing(true);
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
                return;
            }

            await Sharing.shareAsync(tempUri, {
                dialogTitle: `Partager ${document.title}`,
                mimeType: document.mime,
            });
        } catch (error) {
            console.error('Erreur partage:', error);
            Alert.alert('Erreur', 'Impossible de partager le fichier');
        } finally {
            setIsSharing(false);
        }
    }

    // Formater la date
    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    // Rendu selon le type de fichier
    function renderFilePreview() {
        if (!document || !tempUri) return null;

        // Images
        if (document.mime.startsWith('image/')) {
            if (imageError) {
                return (
                    <View style={styles.previewContainer}>
                        <View style={styles.fileIconContainer}>
                            <Text style={styles.fileIconLarge}>🖼️</Text>
                            <Text style={styles.fileTypeText}>Image</Text>
                            <Text style={styles.fileInfoText}>
                                Impossible d'afficher l'aperçu. Utilisez les boutons ci-dessous pour ouvrir l'image.
                            </Text>
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={() => setImageError(false)}
                            >
                                <Text style={styles.retryButtonText}>Réessayer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            }

            return (
                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.imageScrollView}
                >
                    <View style={styles.previewContainer}>
                        <Image
                            source={{ uri: tempUri }}
                            style={styles.image}
                            resizeMode="contain"
                            onError={(error) => {
                                console.error('Erreur chargement image:', error);
                                setImageError(true);
                            }}
                            onLoad={() => {
                                console.log('✅ Image chargée avec succès');
                            }}
                        />
                    </View>
                </ScrollView>
            );
        }

        // PDF et autres documents
        if (document.mime === 'application/pdf') {
            return (
                <View style={styles.previewContainer}>
                    <View style={styles.fileIconContainer}>
                        <Text style={styles.fileIconLarge}>📄</Text>
                        <Text style={styles.fileTypeText}>Document PDF</Text>
                        <Text style={styles.fileInfoText}>
                            Utilisez les boutons ci-dessous pour ouvrir ou partager ce document
                        </Text>
                    </View>
                </View>
            );
        }

        // Documents Word/Excel
        if (document.mime.includes('word') || document.mime.includes('document')) {
            return (
                <View style={styles.previewContainer}>
                    <View style={styles.fileIconContainer}>
                        <Text style={styles.fileIconLarge}>📝</Text>
                        <Text style={styles.fileTypeText}>Document Word</Text>
                        <Text style={styles.fileInfoText}>
                            Utilisez les boutons ci-dessous pour ouvrir ou partager ce document
                        </Text>
                    </View>
                </View>
            );
        }

        if (document.mime.includes('sheet') || document.mime.includes('excel')) {
            return (
                <View style={styles.previewContainer}>
                    <View style={styles.fileIconContainer}>
                        <Text style={styles.fileIconLarge}>📊</Text>
                        <Text style={styles.fileTypeText}>Feuille de calcul</Text>
                        <Text style={styles.fileInfoText}>
                            Utilisez les boutons ci-dessous pour ouvrir ou partager ce document
                        </Text>
                    </View>
                </View>
            );
        }

        // Fichiers texte
        if (document.mime === 'text/plain') {
            return (
                <View style={styles.previewContainer}>
                    <View style={styles.fileIconContainer}>
                        <Text style={styles.fileIconLarge}>📃</Text>
                        <Text style={styles.fileTypeText}>Fichier texte</Text>
                        <Text style={styles.fileInfoText}>
                            Utilisez les boutons ci-dessous pour ouvrir ou partager ce document
                        </Text>
                    </View>
                </View>
            );
        }

        // Type de fichier non reconnu
        return (
            <View style={styles.previewContainer}>
                <View style={styles.fileIconContainer}>
                    <Text style={styles.fileIconLarge}>📎</Text>
                    <Text style={styles.fileTypeText}>Fichier</Text>
                    <Text style={styles.fileInfoText}>
                        Utilisez les boutons ci-dessous pour ouvrir ou partager ce fichier
                    </Text>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>🔓 Déchiffrement en cours...</Text>
            </View>
        );
    }

    if (!document) {
        return null;
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Aperçu du fichier */}
                {renderFilePreview()}

                {/* Informations du document */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoSection}>
                        <Text style={styles.infoLabel}>Titre</Text>
                        <Text style={styles.infoValue}>{document.title}</Text>
                    </View>

                    {document.category && (
                        <View style={styles.infoSection}>
                            <Text style={styles.infoLabel}>Catégorie</Text>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{document.category}</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.infoSection}>
                        <Text style={styles.infoLabel}>Date d'import</Text>
                        <Text style={styles.infoValue}>{formatDate(document.created_at)}</Text>
                    </View>

                    <View style={styles.infoSection}>
                        <Text style={styles.infoLabel}>Taille</Text>
                        <Text style={styles.infoValue}>{formatFileSize(document.size)}</Text>
                    </View>

                    <View style={styles.infoSection}>
                        <Text style={styles.infoLabel}>Type de fichier</Text>
                        <Text style={styles.infoValue}>{document.mime}</Text>
                    </View>

                    <View style={styles.infoSection}>
                        <Text style={styles.infoLabel}>Chiffrement</Text>
                        <Text style={styles.infoValue}>🔒 ChaCha20-Poly1305</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Boutons Ouvrir et Partager */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.button, styles.openButton, isOpening && styles.buttonDisabled]}
                    onPress={handleOpen}
                    disabled={isOpening}
                >
                    {isOpening ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Ouvrir</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.shareButton, isSharing && styles.buttonDisabled]}
                    onPress={handleShare}
                    disabled={isSharing}
                >
                    {isSharing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Partager</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: '#666',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    imageScrollView: {
        backgroundColor: '#000',
    },
    previewContainer: {
        backgroundColor: '#000',
        minHeight: 300,
        justifyContent: 'center',
        alignItems: 'center',
        width: SCREEN_WIDTH,
    },
    image: {
        width: SCREEN_WIDTH,
        height: 400,
        backgroundColor: '#000',
    },
    fileIconContainer: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#ffffffff',
        width: SCREEN_WIDTH,
    },
    fileIconLarge: {
        fontSize: 100,
        marginBottom: 20,
    },
    fileTypeText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    fileInfoText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 280,
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    infoContainer: {
        backgroundColor: '#fff',
        marginTop: 10,
        padding: 20,
    },
    infoSection: {
        marginBottom: 20,
    },
    infoLabel: {
        fontSize: 12,
        color: '#999',
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 16,
        color: '#333',
    },
    categoryBadge: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    categoryText: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
    },
    openButton: {
        backgroundColor: '#34C759',
    },
    shareButton: {
        backgroundColor: '#007AFF',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});