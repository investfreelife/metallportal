import { View, Text, TouchableOpacity } from 'react-native'
import { useAuthStore } from '../../stores/authStore'

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <Text className="text-xl font-bold text-dark mb-2">
        {profile?.full_name ?? 'Профиль'}
      </Text>
      <Text className="text-slate-500 mb-8">
        {profile?.role === 'supplier' ? 'Поставщик' : 'Покупатель'}
      </Text>
      <TouchableOpacity
        onPress={signOut}
        className="border border-red-300 rounded-xl px-8 py-3"
      >
        <Text className="text-red-500 font-medium">Выйти</Text>
      </TouchableOpacity>
    </View>
  )
}
