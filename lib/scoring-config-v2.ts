export interface ScoringConfig {
    organic_strong_pos: number;
    organic_near_strong_pos: number;
    organic_weak_pos: number;
    profitable_roas: number;
    high_roas: number;
    low_roas: number;
    min_clicks_exact: number;
    reduce_cost_threshold: number;
    investigate_cost_threshold: number;
    defend_comp_threshold: number;
    low_impression_share: number;
    expected_ctr_model: {
        pos_1: number;
        pos_2: number;
        pos_3: number;
        pos_5: number;
        pos_10: number;
        pos_20: number;
        pos_plus: number;
    }
}

export const SCORING_CONFIG_V2: ScoringConfig = {
    organic_strong_pos: 2, // 1-2
    organic_near_strong_pos: 4, // 3-4
    organic_weak_pos: 10,
    profitable_roas: 2.5,
    high_roas: 4.0,
    low_roas: 2.0,
    min_clicks_exact: 10,
    reduce_cost_threshold: 20,
    investigate_cost_threshold: 50,
    defend_comp_threshold: 60,
    low_impression_share: 50,
    expected_ctr_model: {
        pos_1: 0.27,
        pos_2: 0.15,
        pos_3: 0.10,
        pos_5: 0.06,
        pos_10: 0.03,
        pos_20: 0.01,
        pos_plus: 0.005
    }
};
