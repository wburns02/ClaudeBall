/**
 * Geography System — where you grow up shapes everything.
 * Development speed, scout exposure, weather, baseball culture.
 */

import type { Component } from '../ecs/types.ts';

export type Region =
  | 'southern_california' | 'texas' | 'florida' | 'dominican_republic'
  | 'japan' | 'puerto_rico' | 'northeast' | 'midwest' | 'venezuela';

export interface GeographyComponent extends Component {
  type: 'Geography';
  region: Region;
  city: string;
  climate: 'tropical' | 'warm' | 'temperate' | 'cold';
  baseballCulture: number;      // 1-100 how baseball-centric
  scoutExposure: number;        // 1-100 how many scouts visit
  competitionLevel: number;     // 1-100 quality of opponents
  yearRoundTraining: boolean;
  developmentModifier: number;  // multiplier (0.85 - 1.15)
  mentalToughnessBonus: number; // cold weather builds mental toughness
  costOfLiving: number;         // affects family financial events
}

interface RegionConfig {
  cities: string[];
  climate: GeographyComponent['climate'];
  baseballCulture: number;
  scoutExposure: number;
  competitionLevel: number;
  yearRound: boolean;
  devMod: number;
  mentalBonus: number;
  costOfLiving: number;
  flavor: string;
}

const REGIONS: Record<Region, RegionConfig> = {
  southern_california: {
    cities: ['Los Angeles', 'San Diego', 'Orange County', 'Long Beach', 'Riverside'],
    climate: 'warm', baseballCulture: 90, scoutExposure: 95, competitionLevel: 95,
    yearRound: true, devMod: 1.15, mentalBonus: 0, costOfLiving: 85,
    flavor: 'Elite travel ball, year-round training, maximum exposure. Expensive and cutthroat.',
  },
  texas: {
    cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Port Lavaca'],
    climate: 'warm', baseballCulture: 80, scoutExposure: 80, competitionLevel: 85,
    yearRound: true, devMod: 1.10, mentalBonus: 5, costOfLiving: 55,
    flavor: 'Football-first culture, but HS baseball is strong. Two-sport pressure is real.',
  },
  florida: {
    cities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Myers'],
    climate: 'tropical', baseballCulture: 85, scoutExposure: 90, competitionLevel: 90,
    yearRound: true, devMod: 1.12, mentalBonus: 0, costOfLiving: 65,
    flavor: 'Baseball factories and showcase HQ. The pipeline to pro ball.',
  },
  dominican_republic: {
    cities: ['San Pedro de Macorís', 'Santo Domingo', 'La Romana', 'Santiago', 'San Cristóbal'],
    climate: 'tropical', baseballCulture: 100, scoutExposure: 75, competitionLevel: 80,
    yearRound: true, devMod: 1.10, mentalBonus: 10, costOfLiving: 15,
    flavor: 'Baseball is life. Broomsticks and bottle caps. Raw tools develop fast. Poverty fuels hunger.',
  },
  japan: {
    cities: ['Tokyo', 'Osaka', 'Sapporo', 'Yokohama', 'Kobe'],
    climate: 'temperate', baseballCulture: 95, scoutExposure: 50, competitionLevel: 85,
    yearRound: false, devMod: 1.05, mentalBonus: 15, costOfLiving: 80,
    flavor: 'Structure, discipline, fundamentals. Slower path to MLB but exceptional polish.',
  },
  puerto_rico: {
    cities: ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas'],
    climate: 'tropical', baseballCulture: 90, scoutExposure: 70, competitionLevel: 75,
    yearRound: true, devMod: 1.08, mentalBonus: 5, costOfLiving: 40,
    flavor: 'Proud baseball tradition. Bilingual advantage. Year-round training.',
  },
  northeast: {
    cities: ['New York', 'Boston', 'Philadelphia', 'Pittsburgh', 'Hartford'],
    climate: 'cold', baseballCulture: 70, scoutExposure: 60, competitionLevel: 70,
    yearRound: false, devMod: 0.90, mentalBonus: 15, costOfLiving: 75,
    flavor: 'Short seasons, tough conditions. Develops mental toughness. Under-the-radar talent.',
  },
  midwest: {
    cities: ['Chicago', 'St. Louis', 'Kansas City', 'Indianapolis', 'Omaha'],
    climate: 'cold', baseballCulture: 65, scoutExposure: 45, competitionLevel: 60,
    yearRound: false, devMod: 0.88, mentalBonus: 12, costOfLiving: 45,
    flavor: 'Small-town baseball. Less competition but loyal communities. Chip on your shoulder.',
  },
  venezuela: {
    cities: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Puerto La Cruz'],
    climate: 'tropical', baseballCulture: 95, scoutExposure: 65, competitionLevel: 75,
    yearRound: true, devMod: 1.05, mentalBonus: 12, costOfLiving: 15,
    flavor: 'Academy system. Passionate culture. Economic instability creates urgency.',
  },
};

export function createGeography(region: Region, rng: () => number = Math.random): GeographyComponent {
  const config = REGIONS[region];
  const city = config.cities[Math.floor(rng() * config.cities.length)];

  return {
    type: 'Geography',
    region,
    city,
    climate: config.climate,
    baseballCulture: config.baseballCulture,
    scoutExposure: config.scoutExposure + Math.round((rng() - 0.5) * 10),
    competitionLevel: config.competitionLevel + Math.round((rng() - 0.5) * 10),
    yearRoundTraining: config.yearRound,
    developmentModifier: config.devMod,
    mentalToughnessBonus: config.mentalBonus,
    costOfLiving: config.costOfLiving,
  };
}

export function getRegionDescriptions(): { id: Region; label: string; flavor: string; climate: string; devMod: string }[] {
  return Object.entries(REGIONS).map(([id, config]) => ({
    id: id as Region,
    label: config.cities[0] + ' area',
    flavor: config.flavor,
    climate: config.climate,
    devMod: config.devMod >= 1.0 ? `+${Math.round((config.devMod - 1) * 100)}% dev` : `${Math.round((config.devMod - 1) * 100)}% dev`,
  }));
}
