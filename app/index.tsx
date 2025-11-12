import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { deleteDocument, getAllDocuments } from '../src/db';
import { deleteEncryptedFile, formatFileSize } from '../src/files';
import { DocumentEntry } from '../src/types';

export default function HomeScreen() {
    const router = useRouter();
    const [documents, setDocuments] = useState<DocumentEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Charger les documents
    const loadDocuments = useCallback(async () => {
        setIsLoading(true);
        try {
            const docs = await getAllDocuments();
            setDocuments(docs);
        } catch (error) {
            console.error('Erreur chargement documents:', error);
            Alert.alert('Erreur', 'Impossible de charger les documents');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Recharger à chaque fois que l'écran est affiché
    useFocusEffect(
        useCallback(() => {
            loadDocuments();
        }, [loadDocuments])
    );

    // Supprimer un document
    async function handleDeleteDocument(doc: DocumentEntry) {
        Alert.alert(
            'Supprimer le document',
            `Êtes-vous sûr de vouloir supprimer "${doc.title}" ?\n\nCette action est irréversible.`,
            [
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Supprimer le fichier chiffré
                            await deleteEncryptedFile(doc.filename);
                            // Supprimer de la base de données
                            await deleteDocument(doc.id);
                            // Recharger la liste
                            await loadDocuments();
                            Alert.alert('Succès', 'Document supprimé');
                        } catch (error) {
                            console.error('Erreur suppression:', error);
                            Alert.alert('Erreur', 'Impossible de supprimer le document');
                        }
                    },
                },
            ]
        );
    }

    // Voir un document
    function handleViewDocument(doc: DocumentEntry) {
        router.push({
            pathname: '/view',
            params: { id: doc.id },
        });
    }

    // Formater la date
    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    // Icône selon le type de fichier
    function getFileIcon(mimeType: string): string {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType === 'application/pdf') return '📄';
        if (mimeType.includes('word')) return '📝';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
        return '📎';
    }

    // Affichage d'un document
    function renderDocument({ item }: { item: DocumentEntry }) {
        return (
            <TouchableOpacity
                style={styles.documentCard}
                onPress={() => handleViewDocument(item)}
                onLongPress={() => handleDeleteDocument(item)}
            >
                <View style={styles.documentIcon}>
                    <Text style={styles.iconText}>{getFileIcon(item.mime)}</Text>
                </View>

                <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle} numberOfLines={1}>
                        {item.title}
                    </Text>
                    
                    <View style={styles.documentMeta}>
                        {item.category && (
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{item.category}</Text>
                            </View>
                        )}
                        <Text style={styles.metaText}>
                            {formatDate(item.created_at)} • {formatFileSize(item.size)}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteDocument(item)}
                >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    }

    // Vue vide
    function renderEmpty() {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyTitle}>Aucun document</Text>
                <Text style={styles.emptySubtitle}>
                    Appuyez sur le bouton + pour importer votre premier document
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={documents}
                renderItem={renderDocument}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={[
                    styles.listContent,
                    documents.length === 0 && styles.listContentEmpty,
                ]}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={loadDocuments} />
                }
            />

            {/* Bouton FAB pour importer */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/import')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    listContent: {
        padding: 15,
    },
    listContentEmpty: {
        flex: 1,
    },
    documentCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    documentIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F0F8FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: {
        fontSize: 24,
    },
    documentInfo: {
        flex: 1,
    },
    documentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
    },
    documentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryBadge: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    categoryText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '600',
    },
    metaText: {
        fontSize: 12,
        color: '#999',
    },
    deleteButton: {
        padding: 8,
        marginLeft: 8,
    },
    deleteButtonText: {
        fontSize: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        fontSize: 80,
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    fabText: {
        fontSize: 32,
        color: '#fff',
        fontWeight: '300',
    },
});