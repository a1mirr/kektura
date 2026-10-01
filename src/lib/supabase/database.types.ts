// Generated from the local test database (built from supabase/migrations) by
// `npm run types:gen`. Do not edit by hand: change a migration, `npm run testdb:reset`, then
// regenerate. `npm run types:check` (run in CI) fails when this file is stale.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "checkpoints": {
                  Row: {
                    "code": string | null,"description": string | null,"elevation_m": number | null,"id": number,"km_from_start": number,"lat": number | null,"lng": number | null,"name": string,"place_key": string | null,"seq": number,"stage": number | null,"stage_seq": number | null
                  }
                  Insert: {
                    "code"?: string | null,"description"?: string | null,"elevation_m"?: number | null,"id"?: number,"km_from_start"?: number,"lat"?: number | null,"lng"?: number | null,"name": string,"place_key"?: string | null,"seq": number,"stage"?: number | null,"stage_seq"?: number | null
                  }
                  Update: {
                    "code"?: string | null,"description"?: string | null,"elevation_m"?: number | null,"id"?: number,"km_from_start"?: number,"lat"?: number | null,"lng"?: number | null,"name"?: string,"place_key"?: string | null,"seq"?: number,"stage"?: number | null,"stage_seq"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"extra_stamps": {
                  Row: {
                    "code": string,"description": string | null,"id": number,"km_from_start": number,"lat": number,"lng": number,"name": string,"off_trail_m": number
                  }
                  Insert: {
                    "code": string,"description"?: string | null,"id"?: number,"km_from_start"?: number,"lat": number,"lng": number,"name": string,"off_trail_m"?: number
                  }
                  Update: {
                    "code"?: string,"description"?: string | null,"id"?: number,"km_from_start"?: number,"lat"?: number,"lng"?: number,"name"?: string,"off_trail_m"?: number
                  }
                  Relationships: [
                    
                  ]
                },"user_extra_stamps": {
                  Row: {
                    "extra_id": number,"stamped_on": string,"user_id": string
                  }
                  Insert: {
                    "extra_id": number,"stamped_on"?: string,"user_id": string
                  }
                  Update: {
                    "extra_id"?: number,"stamped_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_extra_stamps_extra_id_fkey"
      columns: ["extra_id"]
isOneToOne: false
      referencedRelation: "extra_stamps"
      referencedColumns: ["id"]
    }
                  ]
                },"user_stamps": {
                  Row: {
                    "checkpoint_id": number,"note": string | null,"stamped_on": string,"user_id": string
                  }
                  Insert: {
                    "checkpoint_id": number,"note"?: string | null,"stamped_on"?: string,"user_id": string
                  }
                  Update: {
                    "checkpoint_id"?: number,"note"?: string | null,"stamped_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_stamps_checkpoint_id_fkey"
      columns: ["checkpoint_id"]
isOneToOne: false
      referencedRelation: "checkpoints"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
