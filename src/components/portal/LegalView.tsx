"use client";

import { useEffect } from "react";
import { Scale, FileText, ShieldCheck, ScrollText, MoonStar } from "lucide-react";
import { usePortal } from "./store";

const TABS = [
  { id: "termos", label: "Termos de Uso", icon: <FileText className="h-4 w-4" /> },
  { id: "privacidade", label: "Privacidade (LGPD)", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "regras", label: "Regras & Conteúdo +18", icon: <ScrollText className="h-4 w-4" /> },
];

const UPDATED = "27 de outubro de 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-foreground">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</li>;
}

function Termos() {
  return (
    <div>
      <H>1. Aceitação e natureza do serviço</H>
      <P>
        Bem-vindo ao <strong>OtakuVerse</strong>. Ao acessar ou usar este site, criar conta ou interagir com qualquer recurso,
        você declara ter lido, compreendido e aceito integralmente estes Termos de Uso, a Política de Privacidade e as Regras de Conteúdo.
        Se você não concorda com qualquer ponto, não utilize a plataforma. O OtakuVerse é um serviço informativo de descoberta,
        catálogo e recomendação de obras de cultura pop asiática (mangás, manhwas, manhuas, light novels, animes e dramas),
        operado de forma independente e sem fins de hospedagem, distribuição ou comercialização de obras protegidas.
      </P>
      <H>2. O que o OtakuVerse é — e o que não é</H>
      <P>O OtakuVerse funciona como uma enciclopédia interativa e assistente pessoal de descoberta:</P>
      <ul className="mt-1 list-disc pl-5">
        <LI><strong>É</strong>: um agregador de metadados (títulos, sinopses, notas, tags, datas, revistas de publicação) obtidos de fontes públicas
        (AniList, Kitsu, MangaUpdates, Wikipédia), com links que apontam para portais oficiais e plataformas de streaming/leitura legítimas.</LI>
        <LI><strong>Não é</strong>: um site de streaming, download, leitura pirateada ou hospedagem de conteúdo audiovisual/editorial.
        Não armazenamos, distribuímos ou reproduzimos nenhuma obra, imagem de mídia comercial de forma permanente em servidores próprios além de
        cache técnico temporário destinado à exibição de miniaturas informativas.</LI>
      </ul>
      <H>3. Conta do usuário</H>
      <ul className="mt-1 list-disc pl-5">
        <LI>Você deve fornecer e-mail válido, nome de usuário e senha com no mínimo 8 caracteres (letras e números).</LI>
        <LI>É proibido criar contas falsas, de terceiros, automatizadas (bots) ou múltiplas contas para burlar moderações e limites.</LI>
        <LI>Senha é armazenada apenas como hash criptográfico scrypt com salt aleatório; nunca em texto puro. Você é responsável por guardar suas credenciais.</LI>
        <LI>Encerramento por você: basta solicitar (logout + exclusão via contato). Encerramento por nós: em caso de violação destes Termos, sem prejuízo de medidas legais.</LI>
        <LI>Sua biblioteca (favoritos, listas, notas) é sincronizada na sua "nuvem pessoal" e pode ser exportada a qualquer momento como backup .json.</LI>
      </ul>
      <H>4. Modo Adulto (+18) — consentimento específico</H>
      <P>
        O catálogo principal é destinado a todos os públicos e nunca exibe conteúdo adulto explícito. Existe, de forma opcional,
        oculta dentro do perfil e desativada por padrão, a possibilidade de ativar um "Modo Adulto" que libera uma área separada
        (Zona Adulta) com obras classificadas +18 (hentai, doujin e adulto em geral). Ao ativar, você declara sob sua responsabilidade que:
      </P>
      <ul className="mt-1 list-disc pl-5">
        <LI>tem no mínimo 18 anos ou a maioridade legal do seu país;</LI>
        <LI>o acesso a conteúdo adulto é permitido na sua jurisdição;</LI>
        <LI>assume integral responsabilidade pelo próprio acesso; e</LI>
        <LI>compreende que o consentimento é registrado com data/hora e reversível a qualquer momento.</LI>
      </ul>
      <P>
        É estritamente proibido que adultos permitam ou facilitem o acesso de menores ao Modo Adulto ou à Zona Adulta.
        Conteúdo ilegal (em especial qualquer material que sexualize menores) é terminantemente banido e, se identificado, será reportado às autoridades competentes.
      </P>
      <H>5. Propriedade intelectual e avisos de terceiros</H>
      <P>
        Todas as obras, personagens, nomes, capas e marcas citados pertencem aos seus respectivos autores, editoras, estúdios e plataformas
        (ex.: Shueisha, Kodansha, Kadokawa, NAVER, Kakao, Netflix, Crunchyroll). O OtakuVerse reivindica apenas seus elementos próprios
        (marca, código, curadoria, textos editoriais originais). Se você é titular de direitos e acredita que algum elemento exibido aqui
        viola seus direitos (ex.: capa exibida fora de contexto aceitável), envie notificação com identificação da obra, do material e da prova de titularidade
        — removeremos ou ajustaremos o item prontamente, seguindo lógica de notice-and-takedown.
      </P>
      <H>6. Conduta proibida</H>
      <ul className="mt-1 list-disc pl-5">
        <LI>Usar o serviço para qualquer fim ilegal, fraudulento ou lesivo a terceiros.</LI>
        <LI>Tentar burlar o Modo Adulto, sistemas de gating, autenticação, limites de requisição ou medidas de segurança.</LI>
        <LI>Executar scraping abusivo, ataques de negação de serviço, injeção de código ou exploração de vulnerabilidades — pesquisas de segurança em boa fé devem ser reportadas discretamente e são bem-vindas.</LI>
        <LI>Revender, sublicenciar ou explorar comercialmente o serviço sem autorização escrita.</LI>
      </ul>
      <H>7. Disponibilidade, atualização automática e limites</H>
      <P>
        O catálogo é atualizado automaticamente (periódico, a cada ~30 minutos, além de buscas ao vivo) e pode conter imprecisões de terceiros.
        Não garantimos disponibilidade ininterrupta; funcionalidades podem ser suspensas para manutenção, e fontes externas podem ficar indisponíveis
        sem aviso. O serviço é fornecido "no estado em que se encontra" ("as is") e "conforme disponível".
      </P>
      <H>8. IA generativa</H>
      <P>
        A assistente virtual "Aoi" gera respostas automatizadas com base no catálogo e pode errar, alucinar ou desagradar.
        Recomendações são opiniões algorítmicas, não aconselhamento profissional. Não há garantia de exatidão em textos gerados por IA;
        verifique sempre a página da obra e as fontes oficiais.
      </P>
      <H>9. Limitação de responsabilidade</H>
      <P>
        Na máxima extensão permitida pela lei, o OtakuVerse e seus operadores não respondem por danos indiretos, lucros cessantes,
        perda de dados (exceto obrigação de disponibilizar exportação da sua biblioteca), nem por conteúdo de sites externos acessados
        por links. Indicações de onde assistir/ler são informativas e não configuram parceria, patrocínio ou garantia de disponibilidade da plataforma de destino.
      </P>
      <H>10. Alterações, foro e legislação</H>
      <P>
        Estes Termos podem ser atualizados; a versão vigente terá sempre a data de revisão no topo e alterações materiais serão destacadas.
        O uso continuado após mudanças implica aceitação. Aplica-se a legislação brasileira, especialmente o Marco Civil da Internet
        (Lei 12.965/2014), o Estatuto da Criança e do Adolescente (Lei 8.069/1990) no que couber, e a LGPD (Lei 13.709/2018).
        Fica eleito o foro do domicílio do usuário para dirimir controvérsias, sem prejuízo de normas de proteção do consumidor mais favoráveis.
      </P>
    </div>
  );
}

function Privacidade() {
  return (
    <div>
      <P>
        Esta Política de Privacidade explica quais dados o OtakuVerse trata, por quê, por quanto tempo e quais são os seus direitos —
        em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD, Lei 13.709/2018) e boas práticas internacionais (GDPR-inspired).
      </P>
      <H>1. Dados que tratamos</H>
      <ul className="mt-1 list-disc pl-5">
        <LI><strong>Dados de conta</strong>: e-mail, nome de usuário, nome de exibição, cor/avatar, bio — fornecidos por você no cadastro/perfil.</LI>
        <LI><strong>Credencial</strong>: sua senha nunca é armazenada; guardamos apenas um hash scrypt (N=16384, salt aleatório por usuário), irreversível.</LI>
        <LI><strong>Sessões</strong>: token de sessão (cookie httpOnly), data de criação/expiração e identificador resumido do navegador/dispositivo para exibir "sessões ativas".</LI>
        <LI><strong>Biblioteca na nuvem</strong>: obras que você marca (status, nota, nota pessoal) e timestamps para sincronizar dispositivos.</LI>
        <LI><strong>Preferências</strong>: tema, modo do carrossel, consentimento do Modo Adulto (booleano + data/hora — sem documento anexado).</LI>
        <LI><strong>Registro técnico</strong>: eventos essenciais de segurança (cadastro, login, alternância +18, sincronizações) e limites anti-abuso por IP (em memória, de curta duração).</LI>
      </ul>
      <H>2. O que NÃO fazemos</H>
      <ul className="mt-1 list-disc pl-5">
        <LI>Não vendemos, alugamos ou cedemos seus dados pessoais a terceiros. Nunca.</LI>
        <LI>Não usamos rastreadores publicitários de terceiros nem perfis de publicidade comportamental.</LI>
        <LI>Não exigimos dados sensíveis (origem racial, religião, saúde, biometria etc.).</LI>
      </ul>
      <H>3. Finalidades e base legal</H>
      <ul className="mt-1 list-disc pl-5">
        <LI><strong>Executar contrato</strong> (criar conta, autenticar, sincronizar sua biblioteca na nuvem, exportar/importar backups).</LI>
        <LI><strong>Consentimento</strong> (Modo Adulto — registrado com data/hora e revogável a qualquer momento no perfil).</LI>
        <LI><strong>Legítimo interesse</strong> (segurança: limites de taxa, prevenção a abuso, registro mínimo de eventos).</LI>
        <LI><strong>Obrigação legal</strong> (atendimento a ordens judiciais/administrativas, se houver).</LI>
      </ul>
      <H>4. Cookies</H>
      <P>
        Usamos apenas um cookie essencial: <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">ov_session</code> (httpOnly, SameSite=Lax),
        que mantém você autenticado por até 30 dias com renovação deslizante. Seu navegador também guarda localmente (localStorage) um espelho
        da sua biblioteca e preferências de tema — dados que pertencem a você e podem ser limpos a qualquer momento pelo perfil ("Limpar cache local")
        ou pelas configurações do navegador.
      </P>
      <H>5. Compartilhamento com fontes de dados</H>
      <P>
        Para exibir catálogo e imagens, o servidor consulta APIs públicas (AniList, Kitsu, MangaUpdates, Wikipédia) e atua como proxy técnico
        de imagens com cache temporário. Essas consultas não incluem seus dados pessoais — apenas identificadores públicos das obras.
        Links externos (X/Twitter, MyAnimeList, portais oficiais) abrem em nova aba sob as políticas dos próprios sites.
      </P>
      <H>6. Retenção e segurança</H>
      <P>
        Dados de conta e biblioteca permanecem enquanto sua conta existir. Sessões expiram em 30 dias (limpeza automática).
        Registros técnicos de segurança são mantidos por prazo reduzido. Medidas técnicas adotadas: hash de senha com scrypt+salt,
        cookies httpOnly, rate limiting, cabeçalhos de segurança (nosniff, X-Frame-Options, Referrer-Policy: no-referrer),
        princípio do menor privilégio nas APIs (nada de conteúdo adulto sem consentimento ativo). Nenhum sistema é 100% infalível,
        mas comprometemo-nos a responder e mitigar incidentes com transparência.
      </P>
      <H>7. Seus direitos (art. 18, LGPD)</H>
      <P>Você pode a qualquer momento, sem custo:</P>
      <ul className="mt-1 list-disc pl-5">
        <LI><strong>Confirmar acesso</strong> aos seus dados (estão todos no seu perfil e biblioteca);</LI>
        <LI><strong>Corrigir</strong> (edição direta de nome, bio, avatar, notas);</LI>
        <LI><strong>Portabilidade</strong> (backup .json completo para download);</LI>
        <LI><strong>Eliminar</strong> (remoção item a item ou limpeza de cache; exclusão de conta mediante solicitação);</LI>
        <LI><strong>Revogar consentimento</strong> (desligar o Modo Adulto no perfil — efeito imediato);</LI>
        <LI><strong>Oppor-se ao tratamento</strong> e reclamar à ANPD.</LI>
      </ul>
      <H>8. Menores</H>
      <P>
        O catálogo principal é adequado a adolescentes, mas a criação de conta exige, para o Modo Adulto, declaração de 18+.
        Recomendamos que usuários menores de 18 utilizem o catálogo com acompanhamento dos responsáveis, e nunca acionem o Modo Adulto.
      </P>
    </div>
  );
}

function Regras() {
  return (
    <div>
      <H>1. Sistema de classificação de conteúdo</H>
      <P>
        O OtakuVerse organiza todo o catálogo em três níveis transparentes, exibidos nas obras:
      </P>
      <ul className="mt-1 list-disc pl-5">
        <LI><strong>Livre</strong>: conteúdo para todos os públicos. Preenche a home, o hype, as buscas e o catálogo principal.</LI>
        <LI><strong>Ecchi/Sensorial</strong>: obras com sugestividade, fanservice e humor picante <em>sem</em> nudez explícita. Ficam no catálogo principal,
        sempre etiquetadas (chip "Ecchi") e com filtro dedicado. Etiquetamos honestamente — você escolhe ver ou esconder.</LI>
        <LI><strong>Adulto (+18 / Hentai / Doujin)</strong>: conteúdo explícito. Fica <em>totalmente fora</em> do catálogo principal, da home,
        das buscas e dos carrosséis — só existe dentro da Zona Adulta, atrás do Modo Adulto ativado no perfil com consentimento registrado.</LI>
      </ul>
      <P>
        Tags canônicas adultas: <strong>Hentai</strong> (explícito), <strong>Doujin</strong> (produção independente/autoral, geralmente paródia),
        <strong> +18</strong> (adulto em geral) e <strong>Adulto</strong>. O ecchi não é pornografia — é uma categoria editorial reconhecida;
        doujins de conteúdo explícito sim entram na zona bloqueada. A classificação usa os dados oficiais da fonte (AniList) e revisão manual.
      </P>
      <H>2. Regras da comunidade</H>
      <ul className="mt-1 list-disc pl-5">
        <LI>Respeite autores, editoras, staffs e outros usuários. Zero assédio, discurso de ódio, discriminação ou incitação à violência.</LI>
        <LI>É proibido pedir/compartilhar links de pirataria, scans ilegais ou leaks. Use sempre os portais oficiais indicados nas páginas das obras.</LI>
        <LI>É proibido compartilhar conteúdo adulto fora da Zona Adulta (inclui prints, links e sugestões explícitas no chat com a Aoi).</LI>
        <LI>Spoilers relevantes devem ser evitados nas notas pessoais da biblioteca (elas são visíveis apenas para você, mas mantenha o hábito).</LI>
        <LI>Contas usadas para spam, scraping abusivo ou burla de limites serão suspensas.</LI>
      </ul>
      <H>3. Linha vermelha absoluta — CSAM</H>
      <P>
        Qualquer conteúdo que sexualize menores é <strong>inaceitável e ilegal</strong>, sem exceção e sem discussão. Não existe área, modo ou
        configuração que libere esse tipo de material. Se identificarmos tentativa de inserir/solicitar tal conteúdo, a conta é banida
        permanentemente e as autoridades competentes serão acionadas com os registros necessários (Lei 13.718/2018 e ECA).
      </P>
      <H>4. A Aoi (assistente IA)</H>
      <P>
        A Aoi é sua waifu curadora virtual: responde em português, recomenda apenas obras do catálogo real e respeita suas configurações —
        quando o Modo Adulto está desligado, ela mantém o papo no nível do catálogo principal, mesmo que você insista. Ela não substitui
        contato humano, não é sua psicóloga, e pode errar: trate recomendações como ponto de partida.
      </P>
      <H>5. Aplicação e denúncias</H>
      <P>
        Violações podem gerar: remoção de conteúdo, perda de funcionalidades, suspensão ou banimento permanente.
        Denúncias (inclusive de conteúdo indevido na Zona Adulta ou uso por menores) têm prioridade de tratamento.
        Notificações de titulares de direitos seguem o fluxo do item 5 dos Termos de Uso (notice-and-takedown).
      </P>
    </div>
  );
}

export function LegalView() {
  const legalTab = usePortal((s) => s.legalTab);
  const go = usePortal((s) => s.go);

  useEffect(() => {
    if (!["termos", "privacidade", "regras"].includes(legalTab)) {
      window.history.replaceState(null, "", "#/legal/termos");
      usePortal.setState({ legalTab: "termos" });
    }
  }, [legalTab]);

  const current = ["termos", "privacidade", "regras"].includes(legalTab) ? legalTab : "termos";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Scale className="h-6 w-6 text-primary" /> Documentos & Políticas
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Transparência total sobre como o OtakuVerse funciona, protege e classifica conteúdo. Última revisão: {UPDATED}.</p>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              window.location.hash = `#/legal/${t.id}`;
              usePortal.setState({ legalTab: t.id });
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              current === t.id ? "bg-primary text-primary-foreground shadow" : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <article className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-secondary px-4 py-3">
          <MoonStar className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">OtakuVerse</strong> é um portal informativo independente, sem vínculo com editoras, estúdios ou plataformas.
            Nenhum conteúdo é hospedado aqui. Estes documentos são o compromisso público do serviço; em dúvidas jurídicas específicas,
            procure aconselhamento profissional. Contato: <span className="font-bold text-foreground">contato@otakuverse.app</span>.
          </p>
        </div>
        {current === "termos" && <Termos />}
        {current === "privacidade" && <Privacidade />}
        {current === "regras" && <Regras />}
      </article>
    </div>
  );
}
