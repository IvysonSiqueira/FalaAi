import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type User = { id: string; name: string; email: string };
export type Coordinates = { latitude: number; longitude: number };
export type CategoryId = 'buraco' | 'iluminacao' | 'lixo' | 'vazamento' | 'calcada' | 'outros';
export type OccurrenceStatus = 'Aberta' | 'Em análise' | 'Resolvida';
export type Occurrence = {
  id: string;
  authorId: string;
  author: string;
  categoryId: CategoryId;
  title: string;
  description: string;
  location: string;
  coordinates: Coordinates | null;
  status: OccurrenceStatus;
  photo: string | null;
  photoPath: string | null;
  createdAt: string;
};
// Somente campos editáveis; proprietário, UUID, status e datas vêm do servidor.
export type SelectedPhoto = { uri: string; base64: string; mimeType?: string; fileSize?: number };
// undefined mantém foto; null remove; objeto selecionado substitui.
export type OccurrenceDraft = Pick<Occurrence, 'categoryId' | 'description' | 'location' | 'coordinates'> & { photoChange?: SelectedPhoto | null };
export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  NewReport: { reportId: string } | undefined;
  ReportDetail: { reportId: string };
};
export type MainTabParamList = { Início: undefined; Mapa: undefined; Perfil: undefined };
export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
