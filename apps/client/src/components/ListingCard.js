import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ListingCard({ item, onRequest, onEdit, onDelete, canManage, isDeleting }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.categoryPill}>{item.category}</Text>
      </View>
      <Text style={styles.body}>{item.description || "No description"}</Text>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>Pickup area</Text>
        <Text style={styles.detailText}>{item.pickup_area}</Text>
      </View>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>Collection window</Text>
        <Text style={styles.detailText}>
          {new Date(item.available_from).toLocaleString()} - {item.available_until ? new Date(item.available_until).toLocaleString() : "No end date"}
        </Text>
      </View>
      {item.location_lat != null && item.location_lng != null ? (
        <Text style={styles.meta}>
          Approx map point: {item.location_lat.toFixed(3)}, {item.location_lng.toFixed(3)}
        </Text>
      ) : null}
      {canManage ? (
        <View style={styles.actionRow}>
          <Pressable onPress={() => onEdit(item)} style={[styles.secondaryButton, isDeleting && styles.disabledButton]} disabled={isDeleting}>
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(item)} style={[styles.dangerButton, isDeleting && styles.disabledButton]} disabled={isDeleting}>
            <Text style={styles.dangerButtonText}>{isDeleting ? "Deleting..." : "Delete"}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => onRequest(item.id)} style={styles.button}>
          <Text style={styles.buttonText}>Request Collection</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    gap: 10,
    borderWidth: 1,
    borderColor: "#dce6df"
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#203b35",
    flex: 1
  },
  categoryPill: {
    backgroundColor: "#f7c66a",
    borderRadius: 10,
    color: "#26362f",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  meta: {
    fontSize: 12,
    color: "#5b6b59"
  },
  body: {
    fontSize: 14,
    color: "#354532"
  },
  detailBlock: {
    backgroundColor: "#f7faf7",
    borderRadius: 12,
    gap: 3,
    padding: 10
  },
  detailLabel: {
    color: "#557166",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  detailText: {
    color: "#26362f",
    fontSize: 13,
    fontWeight: "600"
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#315c72",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: "#f9f6f1",
    fontWeight: "700"
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6
  },
  secondaryButton: {
    backgroundColor: "#e8efe4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: "#2d3c2b",
    fontWeight: "700"
  },
  dangerButton: {
    backgroundColor: "#ffe8e0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dangerButtonText: {
    color: "#8a2f1d",
    fontWeight: "700"
  },
  disabledButton: {
    opacity: 0.6
  }
});
