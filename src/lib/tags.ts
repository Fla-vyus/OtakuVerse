// Tags famosas — pontos de entrada curados (rótulo PT-BR → nome oficial da tag na AniList).
// Usado pelos chips do Explorar e pela detecção de etiquetas nos textos da Aoi.
// Os nomes das tags NÃO são traduzidos no resultado (são metadados da fonte original);
// o rótulo do chip só ajuda a achar o tema na língua do usuário.
// Um chip pode mapear para uma EXPRESSÃO de tags: "," = OU entre grupos · "+" = E dentro do grupo.
export const FAMOUS_TAGS: { label: string; tag: string }[] = [
  { label: "Isekai", tag: "Isekai" },
  { label: "Shounen", tag: "Shounen" },
  { label: "Seinen", tag: "Seinen" },
  { label: "Escola", tag: "School" },
  { label: "Magia", tag: "Magic" },
  { label: "Reencarnação feminina", tag: "Reincarnation+Female Protagonist,Villainess" },
];
