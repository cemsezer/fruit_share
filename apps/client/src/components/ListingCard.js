import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ListingCard({ item, onRequest }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{item.category}</Text>
      <Text style={styles.body}>{item.description || "No description"}</Text>
      <Text style={styles.meta}>
        Pickup window: {new Date(item.available_from).toLocaleString()} - {new Date(item.available_until).toLocaleString()}
      </Text>
      <Text style={styles.meta}>
        Approx location: {item.location_lat.toFixed(3)}, {item.location_lng.toFixed(3)}
      </Text>
      <Pressable onPress={() => onRequest(item.id)} style={styles.button}>
        <Text style={styles.buttonText}>Request Collection</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e6e1da"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#233220"
  },
  meta: {
    fontSize: 12,
    color: "#5b6b59"
  },
  body: {
    fontSize: 14,
    color: "#354532"
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#314d2f",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: "#f9f6f1",
    fontWeight: "700"
  }
});
