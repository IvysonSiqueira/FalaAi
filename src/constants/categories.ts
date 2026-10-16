import type { CategoryId } from '../types';

export const CATEGORIES = [
  { id: 'buraco', label: 'Buraco na rua', hint: 'Asfalto ou via danificada', icon: '🚧', color: '#fef3c7', pinColor: '#c2410c' },
  { id: 'iluminacao', label: 'Iluminação', hint: 'Poste apagado ou quebrado', icon: '💡', color: '#e0f2fe', pinColor: '#15803d' },
  { id: 'lixo', label: 'Lixo acumulado', hint: 'Descarte irregular', icon: '🗑️', color: '#f1f5f9', pinColor: '#2563eb' },
  { id: 'vazamento', label: 'Vazamento', hint: 'Água ou esgoto aparente', icon: '💧', color: '#dbeafe', pinColor: '#2563eb' },
  { id: 'calcada', label: 'Calçada', hint: 'Piso irregular ou buraco', icon: '🚶', color: '#ffedd5', pinColor: '#15803d' },
  { id: 'outros', label: 'Outros', hint: 'Qualquer outro problema', icon: '⚠️', color: '#fee2e2', pinColor: '#15803d' },
] as const;

export function getCategory(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[5];
}
