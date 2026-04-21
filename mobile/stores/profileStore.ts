import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CustomerProfile {
  name: string;
  phone: string;
  email: string;
}

interface ProfileState {
  profile: CustomerProfile;
  loaded: boolean;
  setProfile: (p: CustomerProfile) => Promise<void>;
  loadProfile: () => Promise<void>;
}

const KEY = 'customer_profile';

export const useProfileStore = create<ProfileState>((set) => ({
  profile: { name: '', phone: '', email: '' },
  loaded: false,
  loadProfile: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ profile: JSON.parse(raw), loaded: true });
      else set({ loaded: true });
    } catch { set({ loaded: true }); }
  },
  setProfile: async (p) => {
    set({ profile: p });
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  },
}));
