import * as Linking from "expo-linking";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import ListingCard from "./src/components/ListingCard";
import { apiFetch } from "./src/lib/api";
import { supabase } from "./src/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const categories = ["Fruit", "Vegetable", "Herbs", "Other"];

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "Fruit",
    description: "",
    quantity_note: "",
    available_from: "",
    available_until: "",
    location_lat: "",
    location_lng: ""
  });

  const redirectTo = useMemo(() => Linking.createURL("/auth/callback"), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoadingAuth(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    try {
      setLoadingListings(true);
      const data = await apiFetch("/api/listings");
      setListings(data.listings || []);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoadingListings(false);
    }
  }

  async function signInWithProvider(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });

    if (error) {
      Alert.alert("Auth error", error.message);
      return;
    }

    if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function fillApproxLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Location permission was not granted.");
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    const roundedLat = Number(position.coords.latitude.toFixed(3));
    const roundedLng = Number(position.coords.longitude.toFixed(3));
    setForm((prev) => ({
      ...prev,
      location_lat: String(roundedLat),
      location_lng: String(roundedLng)
    }));
  }

  async function submitListing() {
    if (!session?.access_token) {
      Alert.alert("Sign in required", "Please sign in first.");
      return;
    }

    try {
      await apiFetch("/api/listings", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          location_lat: Number(form.location_lat),
          location_lng: Number(form.location_lng)
        })
      });
      setForm({
        title: "",
        category: "Fruit",
        description: "",
        quantity_note: "",
        available_from: "",
        available_until: "",
        location_lat: "",
        location_lng: ""
      });
      await loadListings();
      Alert.alert("Success", "Listing created.");
    } catch (error) {
      Alert.alert("Create failed", error.message);
    }
  }

  async function requestListing(listingId) {
    if (!session?.access_token) {
      Alert.alert("Sign in required", "Please sign in to request collection.");
      return;
    }

    try {
      await apiFetch(`/api/listings/${listingId}/requests`, session.access_token, {
        method: "POST"
      });
      Alert.alert("Sent", "Collection request submitted.");
    } catch (error) {
      Alert.alert("Request failed", error.message);
    }
  }

  if (loadingAuth) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Fruit Share</Text>
        <Text style={styles.subheading}>Reduce local produce waste. Share and collect nearby.</Text>

        <View style={styles.authBox}>
          {session ? (
            <>
              <Text style={styles.userText}>Signed in as: {session.user?.email}</Text>
              <Pressable style={styles.secondaryButton} onPress={signOut}>
                <Text style={styles.secondaryButtonText}>Sign Out</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.authButtons}>
              <Pressable style={styles.primaryButton} onPress={() => signInWithProvider("google")}>
                <Text style={styles.primaryButtonText}>Continue with Google</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => signInWithProvider("github")}>
                <Text style={styles.secondaryButtonText}>Continue with GitHub</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Offer Produce</Text>
          <TextInput
            style={styles.input}
            placeholder="Title (e.g. Organic lemons)"
            value={form.title}
            onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
          />

          <View style={styles.categoryRow}>
            {categories.map((item) => (
              <Pressable
                key={item}
                style={[styles.categoryChip, form.category === item && styles.categoryChipActive]}
                onPress={() => setForm((prev) => ({ ...prev, category: item }))}
              >
                <Text style={form.category === item ? styles.categoryChipTextActive : styles.categoryChipText}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Description"
            value={form.description}
            onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Quantity note (e.g. 2 bags)"
            value={form.quantity_note}
            onChangeText={(value) => setForm((prev) => ({ ...prev, quantity_note: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Available from (ISO e.g. 2026-06-14T09:00:00Z)"
            value={form.available_from}
            onChangeText={(value) => setForm((prev) => ({ ...prev, available_from: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Available until (ISO e.g. 2026-06-15T18:00:00Z)"
            value={form.available_until}
            onChangeText={(value) => setForm((prev) => ({ ...prev, available_until: value }))}
          />

          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              placeholder="Approx latitude"
              value={form.location_lat}
              onChangeText={(value) => setForm((prev) => ({ ...prev, location_lat: value }))}
            />
            <TextInput
              style={[styles.input, styles.locationInput]}
              placeholder="Approx longitude"
              value={form.location_lng}
              onChangeText={(value) => setForm((prev) => ({ ...prev, location_lng: value }))}
            />
          </View>

          <Pressable style={styles.secondaryButton} onPress={fillApproxLocation}>
            <Text style={styles.secondaryButtonText}>Use My Approx Location</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={submitListing}>
            <Text style={styles.primaryButtonText}>Publish Listing</Text>
          </Pressable>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.formTitle}>Available Listings</Text>
          {loadingListings ? <Text>Loading listings...</Text> : null}
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => <ListingCard item={item} onRequest={requestListing} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No listings yet.</Text>}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f4f1ea"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  container: {
    padding: 16,
    gap: 12
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1c2a1d"
  },
  subheading: {
    color: "#445344"
  },
  authBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e6e1da"
  },
  authButtons: {
    gap: 8
  },
  userText: {
    marginBottom: 10,
    color: "#364436"
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e6e1da",
    gap: 8
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2a3729"
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8d2c8",
    backgroundColor: "#fcfbf8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#ccd6cb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#eff4ee"
  },
  categoryChipActive: {
    backgroundColor: "#314d2f",
    borderColor: "#314d2f"
  },
  categoryChipText: {
    color: "#2e3b2d"
  },
  categoryChipTextActive: {
    color: "#ffffff"
  },
  locationRow: {
    flexDirection: "row",
    gap: 8
  },
  locationInput: {
    flex: 1
  },
  primaryButton: {
    backgroundColor: "#314d2f",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#e8efe4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#2d3c2b",
    fontWeight: "700"
  },
  listSection: {
    gap: 10
  },
  emptyText: {
    color: "#5f6e5f"
  }
});
