import { StyleSheet, Text, View } from 'react-native';

export default function ViewScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>👁️ Visualisation</Text>
      <Text style={styles.subtitle}>En développement...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});