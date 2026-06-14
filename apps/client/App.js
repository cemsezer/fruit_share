import * as Linking from "expo-linking";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  ImageBackground,
  Platform,
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
const headerImageUrl = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=80";

const initialListingForm = {
  title: "",
  category: "Fruit",
  description: "",
  quantity_note: "",
  available_from: "",
  available_until: "",
  pickup_area: "",
  location_lat: null,
  location_lng: null
};

const initialProfileForm = {
  display_name: "",
  address_text: "",
  address_lat: null,
  address_lng: null,
  collection_view: "all",
  collection_radius_km: "10"
};

function distanceInKm(firstLat, firstLng, secondLat, secondLng) {
  const earthRadiusKm = 6371;
  const latitudeDelta = ((secondLat - firstLat) * Math.PI) / 180;
  const longitudeDelta = ((secondLng - firstLng) * Math.PI) / 180;
  const firstLatitude = (firstLat * Math.PI) / 180;
  const secondLatitude = (secondLat * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toDateTimeInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value) {
  return value ? new Date(value).toISOString() : "";
}

function normalizeDateTimeForApi(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function DateTimeField({ label, value, onChange }) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <input
          type="datetime-local"
          value={toDateTimeInputValue(value)}
          onChange={(event) => onChange(fromDateTimeInputValue(event.target.value))}
          style={webDateTimeInputStyle}
        />
      </View>
    );
  }

  return (
    <TextInput
      style={styles.input}
      placeholder={`${label} (e.g. 2026-06-14T09:00:00Z)`}
      value={value}
      onChangeText={onChange}
    />
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [activeScreen, setActiveScreen] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [listErrors, setListErrors] = useState([]);
  const [listStatus, setListStatus] = useState("");
  const [accountListings, setAccountListings] = useState([]);
  const [accountRequests, setAccountRequests] = useState([]);
  const [accountErrors, setAccountErrors] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [profileErrors, setProfileErrors] = useState([]);
  const [profileStatus, setProfileStatus] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [form, setForm] = useState(initialListingForm);
  const [formErrors, setFormErrors] = useState([]);
  const [formStatus, setFormStatus] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [editingListingId, setEditingListingId] = useState(null);
  const [deletingListingId, setDeletingListingId] = useState(null);
  const [authErrors, setAuthErrors] = useState([]);
  const [authStatus, setAuthStatus] = useState("");
  const [authAction, setAuthAction] = useState("");

  const redirectTo = useMemo(() => Linking.createURL("/auth/callback"), []);
  const filteredListings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const shouldFilterNearby = profile?.collection_view === "nearby"
      && profile.address_lat != null
      && profile.address_lng != null
      && profile.collection_radius_km != null;
    const radiusKm = Number(profile?.collection_radius_km || 0);

    return listings.filter((item) => {
      if (shouldFilterNearby) {
        if (item.location_lat == null || item.location_lng == null) {
          return false;
        }

        if (distanceInKm(profile.address_lat, profile.address_lng, item.location_lat, item.location_lng) > radiusKm) {
          return false;
        }
      }

      const searchableText = [
        item.title,
        item.category,
        item.description,
        item.quantity_note,
        item.pickup_area
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !query || searchableText.includes(query);
    });
  }, [listings, profile, searchQuery]);

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

  useEffect(() => {
    if (activeScreen === "account" && session?.access_token) {
      loadAccountDetails();
    }
  }, [activeScreen, session?.access_token]);

  useEffect(() => {
    if (session?.access_token) {
      loadProfile();
    } else {
      setProfile(null);
      setProfileForm(initialProfileForm);
    }
  }, [session?.access_token]);

  async function loadListings() {
    try {
      setLoadingListings(true);
      setListErrors([]);
      const data = await apiFetch("/api/listings");
      setListings(data.listings || []);
    } catch (error) {
      setListErrors([error.message]);
    } finally {
      setLoadingListings(false);
    }
  }

  async function loadAccountDetails() {
    if (!session?.access_token) {
      return;
    }

    try {
      setLoadingAccount(true);
      setAccountErrors([]);
      const [listingsData, requestsData] = await Promise.all([
        apiFetch("/api/listings/mine", session.access_token),
        apiFetch("/api/requests/mine", session.access_token)
      ]);
      setAccountListings(listingsData.listings || []);
      setAccountRequests(requestsData.requests || []);
    } catch (error) {
      setAccountErrors([error.message]);
    } finally {
      setLoadingAccount(false);
    }
  }

  async function loadProfile() {
    if (!session?.access_token) {
      return;
    }

    try {
      const data = await apiFetch("/api/profile/me", session.access_token);
      setProfile(data.profile);
      setProfileForm(profileToForm(data.profile));
    } catch (error) {
      setProfileErrors([error.message]);
    }
  }

  function openProfileEdit() {
    setProfileErrors([]);
    setProfileStatus("");
    setProfileForm(profileToForm(profile, session?.user?.email));
    setActiveScreen("profileEdit");
  }

  async function fillProfileLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Location permission was not granted.");
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    setProfileForm((prev) => ({
      ...prev,
      address_lat: Number(position.coords.latitude.toFixed(4)),
      address_lng: Number(position.coords.longitude.toFixed(4))
    }));
  }

  async function saveProfile() {
    if (!session?.access_token) {
      setProfileErrors(["Please sign in before editing your account."]);
      return;
    }

    const validationErrors = validateProfileForm(profileForm);
    setProfileErrors(validationErrors);
    setProfileStatus("");

    if (validationErrors.length > 0) {
      return;
    }

    try {
      setSavingProfile(true);
      const data = await apiFetch("/api/profile/me", session.access_token, {
        method: "PUT",
        body: JSON.stringify({
          display_name: profileForm.display_name.trim(),
          address_text: profileForm.address_text.trim() || null,
          address_lat: profileForm.address_lat,
          address_lng: profileForm.address_lng,
          collection_view: profileForm.collection_view,
          collection_radius_km: profileForm.collection_view === "nearby" ? Number(profileForm.collection_radius_km) : null
        })
      });
      setProfile(data.profile);
      setProfileForm(profileToForm(data.profile));
      setProfileErrors([]);
      setProfileStatus("Account details saved.");
      setActiveScreen("account");
    } catch (error) {
      setProfileErrors([error.message]);
    } finally {
      setSavingProfile(false);
    }
  }

  async function signInWithProvider(provider) {
    setAuthErrors([]);
    setAuthStatus("");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });

    if (error) {
      setAuthErrors([error.message]);
      return;
    }

    if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    }
  }

  async function signInWithEmail() {
    const validationErrors = validateAuthForm(authForm, "sign-in");
    setAuthErrors(validationErrors);
    setAuthStatus("");

    if (validationErrors.length > 0) {
      return;
    }

    try {
      setAuthAction("sign-in");
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email.trim(),
        password: authForm.password
      });

      if (error) {
        setAuthErrors([formatAuthError(error.message)]);
        return;
      }

      setAuthErrors([]);
      setAuthStatus("Signed in successfully.");
      setActiveScreen("home");
    } finally {
      setAuthAction("");
    }
  }

  async function signUpWithEmail() {
    const validationErrors = validateAuthForm(authForm, "sign-up");
    setAuthErrors(validationErrors);
    setAuthStatus("");

    if (validationErrors.length > 0) {
      return;
    }

    try {
      setAuthAction("sign-up");
      const { data, error } = await supabase.auth.signUp({
        email: authForm.email.trim(),
        password: authForm.password
      });

      if (error) {
        setAuthErrors([formatAuthError(error.message)]);
        return;
      }

      setAuthErrors([]);
      setAuthStatus(data.session ? "Account created and signed in." : "Account created. Check your email to confirm your account.");
      if (data.session) {
        setActiveScreen("home");
      }
    } finally {
      setAuthAction("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setActiveScreen("home");
    setAccountListings([]);
    setAccountRequests([]);
    setProfile(null);
    setProfileErrors([]);
    setProfileStatus("");
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
      location_lat: roundedLat,
      location_lng: roundedLng
    }));
  }

  async function submitListing() {
    setFormStatus("");

    if (!session?.access_token) {
      setFormErrors(["Please sign in before publishing a listing."]);
      return;
    }

    const validationErrors = validateListingForm(form);
    setFormErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    try {
      setPublishing(true);
      await apiFetch(editingListingId ? `/api/listings/${editingListingId}` : "/api/listings", session.access_token, {
        method: editingListingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          description: form.description.trim(),
          quantity_note: form.quantity_note.trim(),
          pickup_area: form.pickup_area.trim(),
          available_from: normalizeDateTimeForApi(form.available_from),
          available_until: form.available_until ? normalizeDateTimeForApi(form.available_until) : null
        })
      });
      setForm(initialListingForm);
      setEditingListingId(null);
      setFormErrors([]);
      setListStatus(editingListingId ? "Listing updated." : "Listing published. It is now visible to collectors.");
      await loadListings();
      setActiveScreen("home");
    } catch (error) {
      setFormErrors([error.message]);
    } finally {
      setPublishing(false);
    }
  }

  function startEditingListing(listing) {
    setEditingListingId(listing.id);
    setActiveScreen("publish");
    setFormErrors([]);
    setFormStatus("");
    setForm({
      title: listing.title || "",
      category: listing.category || "Fruit",
      description: listing.description || "",
      quantity_note: listing.quantity_note || "",
      available_from: listing.available_from || "",
      available_until: listing.available_until || "",
      pickup_area: listing.pickup_area || "",
      location_lat: listing.location_lat ?? null,
      location_lng: listing.location_lng ?? null
    });
  }

  function cancelEditingListing() {
    setEditingListingId(null);
    setForm(initialListingForm);
    setFormErrors([]);
    setFormStatus("");
  }

  async function deleteListing(listing) {
    if (!session?.access_token) {
      setFormErrors(["Please sign in before deleting a listing."]);
      return;
    }

    const confirmed = Platform.OS === "web"
      ? globalThis.confirm?.(`Delete "${listing.title}"? Collectors will no longer see it.`)
      : true;

    if (!confirmed) {
      return;
    }

    try {
      setDeletingListingId(listing.id);
      setListErrors([]);
      setListStatus("");
      await apiFetch(`/api/listings/${listing.id}`, session.access_token, { method: "DELETE" });
      if (editingListingId === listing.id) {
        cancelEditingListing();
      }
      setListStatus("Listing deleted.");
      await loadListings();
    } catch (error) {
      setListErrors([error.message]);
    } finally {
      setDeletingListingId(null);
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
        <ImageBackground source={{ uri: headerImageUrl }} style={styles.headerPanel} imageStyle={styles.headerImage}>
          <View style={styles.headerOverlay}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.kicker}>Local surplus produce</Text>
              <Text style={styles.heading}>Fruit Share</Text>
              <Text style={styles.subheading}>Find garden fruit and veg nearby, or offer what would otherwise go to waste.</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navButton, activeScreen === "home" && styles.navButtonActive]}
            onPress={() => setActiveScreen("home")}
          >
            <Text style={activeScreen === "home" ? styles.navButtonTextActive : styles.navButtonText}>Browse</Text>
          </Pressable>
          <Pressable
            style={[styles.navButton, activeScreen === "publish" && styles.navButtonActive]}
            onPress={() => setActiveScreen("publish")}
          >
            <Text style={activeScreen === "publish" ? styles.navButtonTextActive : styles.navButtonText}>{editingListingId ? "Edit" : "Offer Produce"}</Text>
          </Pressable>
        </View>

        <View style={styles.authBox}>
          {session ? (
            <View style={styles.accountRow}>
              <View>
                <Text style={styles.accountLabel}>Signed in</Text>
                <Text style={styles.userText}>{session.user?.email}</Text>
              </View>
              <View style={styles.accountActions}>
                <Pressable style={styles.linkButton} onPress={() => setActiveScreen("account")}>
                  <Text style={styles.linkButtonText}>User details</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={signOut}>
                  <Text style={styles.secondaryButtonText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.accountButton} onPress={() => setActiveScreen("auth")}>
              <Text style={styles.accountButtonText}>Login/Create an account</Text>
            </Pressable>
          )}
        </View>

        {activeScreen === "profileEdit" ? (
          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>Account settings</Text>
                <Text style={styles.formTitle}>Edit User Details</Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => setActiveScreen("account")}>
                <Text style={styles.smallButtonText}>Back</Text>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={profileForm.display_name}
                onChangeText={(value) => setProfileForm((prev) => ({ ...prev, display_name: value }))}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput style={styles.input} value="********" secureTextEntry editable={false} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Add my address (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Street, neighborhood, or town"
                value={profileForm.address_text}
                onChangeText={(value) => setProfileForm((prev) => ({ ...prev, address_text: value }))}
              />
              {profileForm.address_lat != null && profileForm.address_lng != null ? (
                <Text style={styles.locationStatus}>Address location saved for radius filtering.</Text>
              ) : null}
              <Pressable style={styles.secondaryButton} onPress={fillProfileLocation}>
                <Text style={styles.secondaryButtonText}>Use My Current Location for Radius</Text>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Collections to show</Text>
              <View style={styles.categoryRow}>
                <Pressable
                  style={[styles.categoryChip, profileForm.collection_view === "all" && styles.categoryChipActive]}
                  onPress={() => setProfileForm((prev) => ({ ...prev, collection_view: "all" }))}
                >
                  <Text style={profileForm.collection_view === "all" ? styles.categoryChipTextActive : styles.categoryChipText}>All collections</Text>
                </Pressable>
                <Pressable
                  style={[styles.categoryChip, profileForm.collection_view === "nearby" && styles.categoryChipActive]}
                  onPress={() => setProfileForm((prev) => ({ ...prev, collection_view: "nearby" }))}
                >
                  <Text style={profileForm.collection_view === "nearby" ? styles.categoryChipTextActive : styles.categoryChipText}>Within radius</Text>
                </Pressable>
              </View>
            </View>

            {profileForm.collection_view === "nearby" ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Radius from my address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10"
                  keyboardType="numeric"
                  value={String(profileForm.collection_radius_km)}
                  onChangeText={(value) => setProfileForm((prev) => ({ ...prev, collection_radius_km: value }))}
                />
              </View>
            ) : null}

            {profileErrors.length > 0 ? (
              <View style={styles.errorBox}>
                {profileErrors.map((error) => (
                  <Text key={error} style={styles.errorText}>{error}</Text>
                ))}
              </View>
            ) : null}

            {profileStatus ? <Text style={styles.successText}>{profileStatus}</Text> : null}

            <Pressable style={[styles.primaryButton, savingProfile && styles.disabledButton]} onPress={saveProfile} disabled={savingProfile}>
              <Text style={styles.primaryButtonText}>{savingProfile ? "Saving..." : "Save User Details"}</Text>
            </Pressable>
          </View>
        ) : activeScreen === "account" ? (
          <View style={styles.screenStack}>
            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>User details</Text>
                  <Text style={styles.formTitle}>Your Account</Text>
                </View>
                <View style={styles.accountHeaderActions}>
                  <Pressable style={styles.smallButton} onPress={openProfileEdit}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => setActiveScreen("home")}>
                    <Text style={styles.smallButtonText}>Back</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.accountItemMeta}>{profile?.display_name || "Username not set"}</Text>
              <Text style={styles.userText}>{session?.user?.email}</Text>
              {profile?.collection_view === "nearby" && profile?.collection_radius_km ? (
                <Text style={styles.accountItemMeta}>Showing collections within {profile.collection_radius_km} km of your saved location.</Text>
              ) : (
                <Text style={styles.accountItemMeta}>Showing all collections.</Text>
              )}
              {profileStatus ? <Text style={styles.successText}>{profileStatus}</Text> : null}
              {profileErrors.length > 0 ? (
                <View style={styles.errorBox}>
                  {profileErrors.map((error) => (
                    <Text key={error} style={styles.errorText}>{error}</Text>
                  ))}
                </View>
              ) : null}
              {loadingAccount ? <Text style={styles.mutedText}>Loading account details...</Text> : null}
              {accountErrors.length > 0 ? (
                <View style={styles.errorBox}>
                  {accountErrors.map((error) => (
                    <Text key={error} style={styles.errorText}>{error}</Text>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.formCard}>
              <View>
                <Text style={styles.sectionEyebrow}>Your garden shares</Text>
                <Text style={styles.formTitle}>Offered Produce</Text>
              </View>
              {accountListings.length === 0 && !loadingAccount ? (
                <Text style={styles.emptyText}>You have not offered any produce yet.</Text>
              ) : null}
              {accountListings.map((item) => (
                <View key={item.id} style={styles.accountItem}>
                  <Text style={styles.accountItemTitle}>{item.title}</Text>
                  <Text style={styles.accountItemMeta}>{item.category} · {item.status}</Text>
                  <Text style={styles.accountItemMeta}>{item.pickup_area}</Text>
                  <View style={styles.authActionRow}>
                    <Pressable style={[styles.secondaryButton, styles.authActionButton]} onPress={() => startEditingListing(item)}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable style={[styles.dangerInlineButton, styles.authActionButton]} onPress={() => deleteListing(item)}>
                      <Text style={styles.dangerInlineButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.formCard}>
              <View>
                <Text style={styles.sectionEyebrow}>Your pickups</Text>
                <Text style={styles.formTitle}>Collections</Text>
              </View>
              {accountRequests.length === 0 && !loadingAccount ? (
                <Text style={styles.emptyText}>You have not requested any collections yet.</Text>
              ) : null}
              {accountRequests.map((request) => (
                <View key={request.id} style={styles.accountItem}>
                  <Text style={styles.accountItemTitle}>{request.listings?.title || "Produce listing"}</Text>
                  <Text style={styles.accountItemMeta}>Request status: {request.status}</Text>
                  <Text style={styles.accountItemMeta}>{request.listings?.pickup_area || "Pickup area unavailable"}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : activeScreen === "auth" ? (
          <View style={styles.formCard}>
            <View>
              <Text style={styles.sectionEyebrow}>Your account</Text>
              <Text style={styles.formTitle}>Login or Create Account</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={authForm.email}
              onChangeText={(value) => setAuthForm((prev) => ({ ...prev, email: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={authForm.password}
              onChangeText={(value) => setAuthForm((prev) => ({ ...prev, password: value }))}
            />

            {authErrors.length > 0 ? (
              <View style={styles.errorBox}>
                {authErrors.map((error) => (
                  <Text key={error} style={styles.errorText}>{error}</Text>
                ))}
              </View>
            ) : null}

            {authStatus ? <Text style={styles.successText}>{authStatus}</Text> : null}

            <View style={styles.authActionRow}>
              <Pressable
                style={[styles.primaryButton, styles.authActionButton, authAction && styles.disabledButton]}
                onPress={signInWithEmail}
                disabled={Boolean(authAction)}
              >
                <Text style={styles.primaryButtonText}>{authAction === "sign-in" ? "Signing in..." : "Sign In"}</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, styles.authActionButton, authAction && styles.disabledButton]}
                onPress={signUpWithEmail}
                disabled={Boolean(authAction)}
              >
                <Text style={styles.secondaryButtonText}>{authAction === "sign-up" ? "Creating..." : "Sign Up"}</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.primaryButton, authAction && styles.disabledButton]} onPress={() => signInWithProvider("google")} disabled={Boolean(authAction)}>
              <Text style={styles.primaryButtonText}>Continue with Google</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setActiveScreen("home")}> 
              <Text style={styles.secondaryButtonText}>Back to Listings</Text>
            </Pressable>
          </View>
        ) : activeScreen === "home" ? (
          <View style={styles.screenStack}>
            <View style={styles.searchPanel}>
              <View>
                <Text style={styles.sectionEyebrow}>Available now</Text>
                <Text style={styles.screenTitle}>{filteredListings.length} listings</Text>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search location, description, produce"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>

            {listErrors.length > 0 ? (
              <View style={styles.errorBox}>
                {listErrors.map((error) => (
                  <Text key={error} style={styles.errorText}>{error}</Text>
                ))}
              </View>
            ) : null}

            {listStatus ? <Text style={styles.successText}>{listStatus}</Text> : null}
            {loadingListings ? <Text style={styles.mutedText}>Loading listings...</Text> : null}

            <View style={styles.listHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>Posted this week</Text>
                <Text style={styles.listTitle}>Most Recent Listings</Text>
              </View>
            </View>

            <FlatList
              data={filteredListings}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => (
                <ListingCard
                  item={item}
                  onRequest={requestListing}
                  onEdit={startEditingListing}
                  onDelete={deleteListing}
                  canManage={session?.user?.id === item.owner_id}
                  isDeleting={deletingListingId === item.id}
                />
              )}
              ListEmptyComponent={(
                <View style={styles.emptyPanel}>
                  <Text style={styles.emptyTitle}>{searchQuery ? "No matches found" : "No recent listings yet"}</Text>
                  <Text style={styles.emptyText}>{searchQuery ? "Try a different pickup area or produce description." : "Only listings posted within the last 7 days appear here."}</Text>
                  <Pressable style={styles.primaryButton} onPress={() => setActiveScreen("publish")}>
                    <Text style={styles.primaryButtonText}>Offer Produce</Text>
                  </Pressable>
                </View>
              )}
            />
          </View>
        ) : (
          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>{editingListingId ? "Update listing" : "New listing"}</Text>
                <Text style={styles.formTitle}>{editingListingId ? "Edit Produce" : "Offer Produce"}</Text>
              </View>
              {editingListingId ? (
                <Pressable style={styles.smallButton} onPress={cancelEditingListing}>
                  <Text style={styles.smallButtonText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
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
            <DateTimeField
              label="Available from"
              value={form.available_from}
              onChange={(value) => setForm((prev) => ({ ...prev, available_from: value }))}
            />
            <DateTimeField
              label="Available until (optional)"
              value={form.available_until}
              onChange={(value) => setForm((prev) => ({ ...prev, available_until: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Pickup area (e.g. North Park, near Oak Street)"
              value={form.pickup_area}
              onChangeText={(value) => setForm((prev) => ({ ...prev, pickup_area: value }))}
            />

            {form.location_lat != null && form.location_lng != null ? (
              <Text style={styles.locationStatus}>Approx map point saved from this device.</Text>
            ) : null}

            {formErrors.length > 0 ? (
              <View style={styles.errorBox}>
                {formErrors.map((error) => (
                  <Text key={error} style={styles.errorText}>{error}</Text>
                ))}
              </View>
            ) : null}

            {formStatus ? <Text style={styles.successText}>{formStatus}</Text> : null}

            <Pressable style={styles.secondaryButton} onPress={fillApproxLocation}>
              <Text style={styles.secondaryButtonText}>Use My Approx Location</Text>
            </Pressable>

            <Pressable style={[styles.primaryButton, publishing && styles.disabledButton]} onPress={submitListing} disabled={publishing}>
              <Text style={styles.primaryButtonText}>{publishing ? (editingListingId ? "Saving..." : "Publishing...") : (editingListingId ? "Save Changes" : "Publish Listing")}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef3ef"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 28
  },
  headerPanel: {
    borderRadius: 18,
    minHeight: 220,
    overflow: "hidden"
  },
  headerImage: {
    borderRadius: 18
  },
  headerOverlay: {
    backgroundColor: "rgba(22, 38, 32, 0.58)",
    flex: 1,
    gap: 16,
    justifyContent: "flex-end",
    minHeight: 220,
    padding: 18
  },
  headerTextBlock: {
    gap: 6
  },
  kicker: {
    color: "#f7c66a",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  heading: {
    fontSize: 34,
    fontWeight: "800",
    color: "#ffffff"
  },
  subheading: {
    color: "#d8e7dd",
    lineHeight: 20
  },
  navRow: {
    backgroundColor: "#dde8df",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    padding: 5
  },
  navButton: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    paddingVertical: 10
  },
  navButtonActive: {
    backgroundColor: "#ffffff"
  },
  navButtonText: {
    color: "#52645a",
    fontWeight: "800"
  },
  navButtonTextActive: {
    color: "#203b35",
    fontWeight: "800"
  },
  authBox: {
    backgroundColor: "transparent"
  },
  authButtons: {
    gap: 8
  },
  accountButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#315c72",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#24485a",
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  accountButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  authActionRow: {
    flexDirection: "row",
    gap: 8
  },
  authActionButton: {
    flex: 1
  },
  accountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  accountActions: {
    alignItems: "flex-end",
    gap: 8
  },
  accountLabel: {
    color: "#6b7a72",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  userText: {
    color: "#253a33",
    fontWeight: "700"
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  linkButtonText: {
    color: "#315c72",
    fontWeight: "800"
  },
  screenStack: {
    gap: 12
  },
  searchPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#dce6df",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  sectionEyebrow: {
    color: "#557166",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  screenTitle: {
    color: "#203b35",
    fontSize: 22,
    fontWeight: "800"
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#c9d8cf",
    backgroundColor: "#f8fbf8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dce6df",
    gap: 10
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2a3729"
  },
  formHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  accountHeaderActions: {
    flexDirection: "row",
    gap: 8
  },
  smallButton: {
    backgroundColor: "#e8efe4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  smallButtonText: {
    color: "#2d3c2b",
    fontWeight: "700"
  },
  accountItem: {
    backgroundColor: "#f8fbf8",
    borderColor: "#dce6df",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12
  },
  accountItemTitle: {
    color: "#203b35",
    fontSize: 16,
    fontWeight: "800"
  },
  accountItemMeta: {
    color: "#52645a",
    fontSize: 13,
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9d8cf",
    backgroundColor: "#f8fbf8",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    color: "#354532",
    fontSize: 13,
    fontWeight: "700"
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#c9d8cf",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f5faf6"
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
  locationStatus: {
    color: "#52634f",
    fontSize: 13
  },
  errorBox: {
    backgroundColor: "#fff1ed",
    borderColor: "#e8b4a5",
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 10
  },
  errorText: {
    color: "#8a2f1d",
    fontSize: 13
  },
  successText: {
    backgroundColor: "#edf7ed",
    borderColor: "#b9d8b9",
    borderRadius: 10,
    borderWidth: 1,
    color: "#245b2a",
    fontSize: 13,
    padding: 10
  },
  primaryButton: {
    backgroundColor: "#315c72",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#e8f1ec",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#2d3c2b",
    fontWeight: "700"
  },
  dangerInlineButton: {
    alignItems: "center",
    backgroundColor: "#ffe8e0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dangerInlineButtonText: {
    color: "#8a2f1d",
    fontWeight: "800"
  },
  disabledButton: {
    opacity: 0.6
  },
  listSection: {
    gap: 10
  },
  listHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2
  },
  listTitle: {
    color: "#203b35",
    fontSize: 21,
    fontWeight: "800"
  },
  emptyPanel: {
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#dce6df",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  emptyTitle: {
    color: "#203b35",
    fontSize: 18,
    fontWeight: "800"
  },
  emptyText: {
    color: "#5f6e5f"
  },
  mutedText: {
    color: "#5f6e5f"
  }
});

const webDateTimeInputStyle = {
  width: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#c9d8cf",
  backgroundColor: "#f8fbf8",
  borderRadius: 12,
  boxSizing: "border-box",
  color: "#233220",
  fontSize: 14,
  padding: 10
};

function validateListingForm(values) {
  const errors = [];
  const title = values.title.trim();
  const pickupArea = values.pickup_area.trim();
  const fromDate = values.available_from ? new Date(values.available_from) : null;
  const untilDate = values.available_until ? new Date(values.available_until) : null;

  if (title.length < 3) {
    errors.push("Add a title with at least 3 characters, such as 'Organic lemons'.");
  }

  if (!values.quantity_note.trim()) {
    errors.push("Add a quantity note, such as 'one basket' or 'about 2 kg'.");
  }

  if (!values.available_from) {
    errors.push("Choose when collection can start.");
  } else if (Number.isNaN(fromDate.getTime())) {
    errors.push("Choose a valid start date and time.");
  }

  if (values.available_until && Number.isNaN(untilDate.getTime())) {
    errors.push("Choose a valid end date and time.");
  }

  if (fromDate && untilDate && !Number.isNaN(fromDate.getTime()) && !Number.isNaN(untilDate.getTime()) && untilDate <= fromDate) {
    errors.push("The collection end time must be after the start time.");
  }

  if (pickupArea.length < 2) {
    errors.push("Add a pickup area, such as 'North Park' or 'near Oak Street'.");
  }

  return errors;
}

function validateAuthForm(values, mode) {
  const errors = [];
  const email = values.email.trim();

  if (!email) {
    errors.push("Enter your email address.");
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.push("Enter a valid email address.");
  }

  if (!values.password) {
    errors.push("Enter your password.");
  } else if (mode === "sign-up" && values.password.length < 6) {
    errors.push("Use a password with at least 6 characters.");
  }

  return errors;
}

function profileToForm(profile, fallbackEmail = "") {
  const fallbackName = fallbackEmail ? fallbackEmail.split("@")[0] : "";

  return {
    display_name: profile?.display_name || fallbackName,
    address_text: profile?.address_text || "",
    address_lat: profile?.address_lat ?? null,
    address_lng: profile?.address_lng ?? null,
    collection_view: profile?.collection_view || "all",
    collection_radius_km: String(profile?.collection_radius_km || 10)
  };
}

function validateProfileForm(values) {
  const errors = [];
  const displayName = values.display_name.trim();
  const radius = Number(values.collection_radius_km);

  if (displayName.length < 2) {
    errors.push("Add a username with at least 2 characters.");
  }

  if (values.collection_view === "nearby") {
    if (!Number.isFinite(radius) || radius < 1 || radius > 100) {
      errors.push("Choose a radius between 1 and 100 km.");
    }

    if (values.address_lat == null || values.address_lng == null) {
      errors.push("Use your current location so nearby collections can be filtered from your address area.");
    }
  }

  return errors;
}

function formatAuthError(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "An account already exists for this email. Try signing in instead.";
  }

  return message;
}
