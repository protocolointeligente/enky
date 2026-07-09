# ENKY 17 - MODALIDADES E PRESCRIÇÃO MULTIESPORTE
**Versão 1.0** — Modalidades, campos, métricas e lógica de prescrição

---

## Princípio: Modalidade Importa

> Base comum + lógica específica por modalidade. Não copiar corrida para tudo.

---

## Campos Comuns (todo treino)

id, atleta, treinador, modalidade, data, título, objetivo, status, descrição, instruções, duração, intensidade, RPE, observações, origem (manual/modelo/periodização/IA/marketplace), publicação, vínculo calendário

---

## 6 Modalidades Iniciais

### Corrida
**Campos:** distância, pace, zona FC, RPE, blocos intervalados, reps, intervalo, ritmo prova, superfície
**Tipos:** rodagem, longão, intervalado curto/longo, tempo run, fartlek, regenerativo, progressivo, subida, técnica, teste, prova
**Geração:** objetivo + nível + distância-alvo + data prova + VDOT + disponibilidade + histórico + feedback

### Ciclismo
**Campos:** duração, potência, FTP, FC, cadência, RPE, zona potência, terreno, indoor/outdoor
**Tipos:** endurance, base, tempo, sweet spot, limiar, VO2, sprint, cadência, subida, recuperação, rolo, simulado
**Geração:** FTP/FC + nível + objetivo + tipo prova + fase + histórico (sem potência → usar FC/RPE)

### Natação
**Campos:** metragem, piscina 25/50m, nado, ritmo/100m, séries, reps, intervalo, material, educativos
**Tipos:** técnica, contínuo, intervalado, resistência, velocidade, ritmo prova, educativo, soltura, teste
**Geração:** blocos (aquecimento → técnica → principal → soltura) + nível + metragem + ritmo + experiência

### Triatlo
**Campos:** modalidade da sessão, prova-alvo, distribuição semanal, volume/modalidade, carga total, transição
**Tipos:** brick, transição, simulado, longão combinado + tipos individuais por modalidade
**Geração:** prova + distância + nível + distribuição + pontos fortes/fracos + recuperação. **Não gerar como 3 planos separados.**

### Musculação
**Campos:** exercício, grupo muscular, padrão motor, séries, reps, carga, RPE/RIR, intervalo, método, equipamento
**Tipos:** força, hipertrofia, resistência muscular, potência, full body, upper/lower, core, preventivo, complementar
**Geração:** objetivo + nível + frequência + equipamentos + lesões + divisão + progressão

### Funcional
**Campos:** exercício, padrão motor, circuito, rounds, tempo trabalho/pausa, reps, RPE, equipamento
**Tipos:** circuito, EMOM, AMRAP, tempo fixo, estações, mobilidade, core, força funcional, potência
**Geração:** objetivo + nível + tempo + equipamentos + limitações + padrão motor + intensidade

---

## Regras Transversais

- Prescrição automática = rascunho editável sempre
- Feedback com campos comuns + específicos por modalidade
- Análise respeita modalidade (não comparar pace com potência)
- Relatórios adaptam conteúdo por modalidade
- Intelligence diferencia modalidade, indica dados insuficientes
- Zonas de treino por modalidade (pace/FC/potência/RPE/RIR/ritmo100m)
- Prescrição para grupo com individualização posterior

---

## MVP Multiesporte

Corrida completa + musculação/funcional básico + estrutura preparada para ciclismo/natação/triatlo + calendário multiesporte + feedback básico + campos flexíveis
