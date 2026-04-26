export const VAMPIRE_SKILLS = [
  "Atletismo",
  "Carisma",
  "Contatos",
  "Dirigir",
  "Empatia",
  "Expressão",
  "Lutar",
  "Investigar",
  "Conhecimento",
  "Manipulação",
  "Percepção",
  "Ocultismo",
  "Fisiologia",
  "Recursos",
  "Atirar",
  "Furtividade",
  "Ruídos",
  "Sobrevivência",
  "Tecnologia",
  "Vontade",
] as const;

export type VampireSkill = (typeof VAMPIRE_SKILLS)[number];

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [value, numeral] of map) {
    while (n >= value) { result += numeral; n -= value; }
  }
  return result;
}
