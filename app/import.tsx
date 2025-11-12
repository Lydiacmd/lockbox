import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { insertDocument } from '../src/db';
import { encryptAndSaveFile } from '../src/files';
import { DOCUMENT_CATEGORIES, DocumentCategory } from '../src/types';

export default function ImportScreen() {
    const router = useRouter();
    const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<DocumentCategory | ''>('');
    const [isImporting, setIsImporting] = useState(false);

    // Sélectionner un fichier
    async function pickDocument() {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setSelectedFile(file);
                
                // Proposer le nom du fichier comme titre par défaut
                if (!title) {
                    const fileName = file.name.replace(/\.[^/.]+$/, ''); // Enlever l'extension
                    setTitle(fileName);
                }
            }
        } catch (error) {
            console.error('Erreur sélection fichier:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner le fichier');
        }
    }

    // Importer et chiffrer le document
    async function handleImport() {
        if (!selectedFile) {
            Alert.alert('Erreur', 'Veuillez sélectionner un fichier');
            return;
        }

        if (!title.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un titre pour le document');
            return;
        }

        setIsImporting(true);

        try {
            // Chiffrer et sauvegarder le fichier
            const { filename, nonce, size } = await encryptAndSaveFile(selectedFile.uri);

            // Insérer les métadonnées en base de données
            await insertDocument({
                title: title.trim(),
                filename,
                mime: selectedFile.mimeType || 'application/octet-stream',
                nonce,
                category: category || undefined,
                size,
            });

            Alert.alert(
                'Succès',
                'Document importé et chiffré avec succès !',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (error) {
            console.error('Erreur import:', error);
            Alert.alert('Erreur', 'Impossible d\'importer le document');
        } finally {
            setIsImporting(false);
        }
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Section de sélection de fichier */}
                <View style={styles.section}>
                    <Text style={styles.label}>Fichier</Text>
                    <TouchableOpacity
                        style={styles.filePicker}
                        onPress={pickDocument}
                        disabled={isImporting}
                    >
                        {selectedFile ? (
                            <>
                                <Text style={styles.fileIcon}>📄</Text>
                                <View style={styles.fileInfo}>
                                    <Text style={styles.fileName} numberOfLines={1}>
                                        {selectedFile.name}
                                    </Text>
                                    <Text style={styles.fileSize}>
                                        {selectedFile.size
                                            ? `${(selectedFile.size / 1024).toFixed(2)} Ko`
                                            : 'Taille inconnue'}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.fileIcon}>📁</Text>
                                <Text style={styles.filePickerText}>
                                    Appuyez pour sélectionner un fichier
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Titre */}
                <View style={styles.section}>
                    <Text style={styles.label}>Titre *</Text>
                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ex: Carte d'identité"
                        placeholderTextColor="#999"
                        editable={!isImporting}
                    />
                </View>

                {/* Catégorie */}
                <View style={styles.section}>
                    <Text style={styles.label}>Catégorie (optionnel)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.categoryContainer}>
                            {DOCUMENT_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryButton,
                                        category === cat && styles.categoryButtonSelected,
                                    ]}
                                    onPress={() => setCategory(category === cat ? '' : cat)}
                                    disabled={isImporting}
                                >
                                    <Text
                                        style={[
                                            styles.categoryButtonText,
                                            category === cat && styles.categoryButtonTextSelected,
                                        ]}
                                    >
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* Boutons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={() => router.back()}
                        disabled={isImporting}
                    >
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.importButton,
                            (!selectedFile || !title.trim() || isImporting) &&
                                styles.importButtonDisabled,
                        ]}
                        onPress={handleImport}
                        disabled={!selectedFile || !title.trim() || isImporting}
                    >
                        {isImporting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.importButtonText}>🔒 Importer</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 25,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    filePicker: {
        borderWidth: 2,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        flexDirection: 'row',
        backgroundColor: '#F0F8FF',
    },
    fileIcon: {
        fontSize: 40,
        marginRight: 15,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    fileSize: {
        fontSize: 14,
        color: '#666',
    },
    filePickerText: {
        fontSize: 16,
        color: '#007AFF',
        flex: 1,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    categoryContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    categoryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#007AFF',
        backgroundColor: '#fff',
    },
    categoryButtonSelected: {
        backgroundColor: '#007AFF',
    },
    categoryButtonText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '500',
    },
    categoryButtonTextSelected: {
        color: '#fff',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    button: {
        flex: 1,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    importButton: {
        backgroundColor: '#007AFF',
    },
    importButtonDisabled: {
        backgroundColor: '#ccc',
    },
    importButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});