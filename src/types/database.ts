// Contrato da migração inicial. Gerar novamente a partir do projeto confirmado
// quando a migração for aplicada; não confundir com os modelos visuais da Prova II.
type ProfileRow = { id: string; display_name: string; created_at: string };
type OccurrenceRow = {
  id: string;
  author_id: string;
  category_id: 'buraco' | 'iluminacao' | 'lixo' | 'vazamento' | 'calcada' | 'outros';
  description: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_path: string | null;
  status: 'Aberta' | 'Em análise' | 'Resolvida';
  created_at: string;
  updated_at: string;
};
type OccurrenceInput = Pick<OccurrenceRow, 'category_id' | 'description'> &
  Partial<Pick<OccurrenceRow, 'location' | 'latitude' | 'longitude' | 'photo_path'>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never; // Criado pelo trigger do Auth; cliente não insere perfis.
        Update: { display_name?: string };
        Relationships: [];
      };
      occurrence_photo_files: {
        Row: { path: string; owner_id: string; state: 'pending' | 'uploaded' | 'linked' | 'cleanup'; created_at: string; cleanup_after: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      occurrences: {
        Row: OccurrenceRow;
        Insert: OccurrenceInput;
        Update: Partial<OccurrenceInput>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      reserve_occurrence_photo: { Args: { p_extension: string }; Returns: string };
      confirm_occurrence_photo_upload: { Args: { p_path: string }; Returns: boolean };
      abandon_occurrence_photo: { Args: { p_path: string }; Returns: boolean };
      claim_occurrence_photo_cleanup: { Args: Record<string, never>; Returns: string[] };
      finish_occurrence_photo_cleanup: { Args: { p_path: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
