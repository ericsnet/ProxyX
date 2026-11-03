(() => {
  const WORKER = "https://proxyx-gateway.eric-silvestre.workers.dev";
  const $ = (id) => document.getElementById(id);
  const state = { history: [], index: -1, loading: false, lang: "es" };
  const copy = {
    es: {checking:"Comprobando gateway…",online:"Gateway disponible",offline:"Gateway no disponible",headline:'Navega con <span>ProxyX.</span>',lead:"Introduce una dirección y carga su contenido a través de tu gateway de Cloudflare.",load:"Cargar",tokenLabel:"Token del gateway",tokenPlaceholder:"Token Bearer",tokenHint:"Se guarda solo en esta pestaña y no se envía a la web de destino.",ready:"Introduce una URL autorizada para empezar.",viewer:"Visor de página",readerTitle:"Modo de lectura seguro",readerText:"Se muestra el contenido HTML depurado. No se ejecutan scripts ni se cargan formularios, anuncios o recursos externos.",accessTitle:"Destinos autorizados",accessText:"El Worker aplica una lista de dominios permitidos. Ahora mismo, la configuración inicial solo incluye example.com.",notTitle:"No es un proxy abierto",notText:"No evita bloqueos ni controles de acceso y no garantiza que todas las páginas sean compatibles.",footer:"Uso autorizado únicamente",loading:"Cargando contenido…",loaded:"Contenido recibido y depurado.",needToken:"Introduce el token configurado en Cloudflare.",badUrl:"Introduce una URL HTTP o HTTPS válida.",blocked:"El gateway ha rechazado el destino. Comprueba que el dominio esté autorizado.",httpError:"El gateway ha respondido con un error HTTP.",network:"No se pudo conectar con el gateway. Comprueba la configuración CORS y el token.",empty:"La respuesta no contiene HTML que se pueda mostrar.",back:"Atrás",forward:"Adelante",reload:"Recargar"},
    en: {checking:"Checking gateway…",online:"Gateway online",offline:"Gateway unavailable",headline:'Browse with <span>ProxyX.</span>',lead:"Enter an address and load its content through your Cloudflare gateway.",load:"Load",tokenLabel:"Gateway token",tokenPlaceholder:"Bearer token",tokenHint:"Stored only in this tab; it is not sent to the destination website.",ready:"Enter an authorized URL to begin.",viewer:"Page viewer",readerTitle:"Safe reader mode",readerText:"Cleaned HTML content is displayed. Scripts are not executed and forms, ads or external resources are not loaded.",accessTitle:"Authorized destinations",accessText:"The Worker enforces a destination allowlist. The initial configuration currently includes example.com only.",notTitle:"Not an open proxy",notText:"It does not bypass blocks or access controls and cannot guarantee compatibility with every page.",footer:"Authorized use only",loading:"Loading content…",loaded:"Content received and sanitized.",needToken:"Enter the token configured in Cloudflare.",badUrl:"Enter a valid HTTP or HTTPS URL.",blocked:"The gateway rejected this destination. Check that its domain is authorized.",httpError:"The gateway returned an HTTP error.",network:"Could not connect to the gateway. Check CORS configuration and token.",empty:"The response contains no displayable HTML.",back:"Back",forward:"Forward",reload:"Reload"}
  };
  const t = (key) => copy[state.lang][key] || key;
  function setMessage(key, type="") { $("message").textContent = t(key); $("message").className = "message " + type; }
  function setBusy(value) { state.loading=value; $("loadButton").disabled=value; $("loadButton").textContent=value?t("loading"):t("load"); }
  function updateNav() { $("backButton").disabled=state.index<=0||state.loading; $("forwardButton").disabled=state.index>=state.history.length-1||state.loading; $("reloadButton").disabled=state.index<0||state.loading; }
  function normalize(raw) {
    const value=raw.trim();
    const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value)?value:"https://"+value);
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password) throw new Error("url");
    return url.href;
  }
  function escapeHTML(value) { return value.replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
  const allowed = new Set(["ARTICLE","MAIN","HEADER","FOOTER","SECTION","DIV","P","H1","H2","H3","H4","H5","H6","UL","OL","LI","DL","DT","DD","BLOCKQUOTE","PRE","CODE","SPAN","STRONG","B","EM","I","SMALL","BR","HR","TABLE","THEAD","TBODY","TR","TH","TD"]);
  function cleanNode(node) {
    if (node.nodeType===Node.TEXT_NODE) return escapeHTML(node.nodeValue||"");
    if (node.nodeType!==Node.ELEMENT_NODE) return "";
    const tag=node.tagName;
    const children=Array.from(node.childNodes).map(cleanNode).join("");
    if (!allowed.has(tag)) return children;
    return tag==="BR"||tag==="HR"?`<${tag.toLowerCase()}>`:`<${tag.toLowerCase()}>${children}</${tag.toLowerCase()}>`;
  }
  function renderHTML(source) {
    const parsed=new DOMParser().parseFromString(source,"text/html");
    const title=(parsed.querySelector("title")?.textContent||"").trim();
    const body=Array.from(parsed.body.childNodes).map(cleanNode).join("");
    if (!body.trim()) throw new Error("empty");
    $("viewer").srcdoc='<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px/1.65 system-ui,sans-serif;color:#202938;max-width:900px;margin:36px auto;padding:0 24px}h1,h2,h3{line-height:1.2}a{color:#2459b7}pre{overflow:auto;background:#f1f3f7;padding:14px;border-radius:8px}code{background:#f1f3f7;padding:2px 4px;border-radius:4px}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #cbd2dc;padding:7px;text-align:left}blockquote{border-left:3px solid #8ca8df;margin-left:0;padding-left:16px;color:#526078}</style></head><body>'+body+'</body></html>';
    $("pageTitle").textContent=title||t("viewer");
  }
  async function load(raw, push=true) {
    let target;
    try { target=normalize(raw); } catch { setMessage("badUrl","error"); return; }
    const token=$("tokenInput").value.trim();
    if (!token) { setMessage("needToken","error"); $("tokenInput").focus(); return; }
    $("addressInput").value=target;
    setBusy(true); setMessage("loading"); $("pageHost").textContent=new URL(target).host;
    try {
      const response=await fetch(WORKER+"/proxy?url="+encodeURIComponent(target),{headers:{Authorization:"Bearer "+token}});
      if (!response.ok) {
        if (response.status===401||response.status===403) throw new Error("blocked");
        throw new Error("http");
      }
      const type=response.headers.get("content-type")||"";
      const body=await response.text();
      if (type.includes("text/html")||type.includes("application/xhtml")) renderHTML(body);
      else if (type.startsWith("text/")) {
        $("viewer").srcdoc='<!doctype html><meta charset="utf-8"><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 ui-monospace,monospace;padding:24px">'+escapeHTML(body)+'</pre>';
        $("pageTitle").textContent=new URL(target).host;
      } else throw new Error("empty");
      if (push) { state.history=state.history.slice(0,state.index+1); state.history.push(target); state.index=state.history.length-1; }
      setMessage("loaded","success");
    } catch (error) {
      const key=error.message==="blocked"?"blocked":error.message==="empty"?"empty":error.message==="http"?"httpError":"network";
      setMessage(key,"error");
    } finally { setBusy(false); updateNav(); }
  }
  $("addressForm").addEventListener("submit",e=>{e.preventDefault();load($("addressInput").value);});
  $("backButton").addEventListener("click",()=>{if(state.index>0){state.index--;load(state.history[state.index],false);}});
  $("forwardButton").addEventListener("click",()=>{if(state.index<state.history.length-1){state.index++;load(state.history[state.index],false);}});
  $("reloadButton").addEventListener("click",()=>{if(state.index>=0)load(state.history[state.index],false);});
  $("tokenInput").value=sessionStorage.getItem("proxyx-token")||"";
  $("tokenInput").addEventListener("input",()=>sessionStorage.setItem("proxyx-token",$("tokenInput").value));
  $("languageToggle").addEventListener("click",()=>{
    state.lang=state.lang==="es"?"en":"es";
    document.documentElement.lang=state.lang;
    $("languageToggle").textContent=state.lang==="es"?"EN":"ES";
    document.querySelectorAll("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;el.innerHTML=t(key);});
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
    $("backButton").title=t("back");$("forwardButton").title=t("forward");$("reloadButton").title=t("reload");
    if (!$("message").classList.contains("error")&&!state.loading) setMessage("ready");
    if (!$("loadButton").disabled) $("loadButton").textContent=t("load");
  });
  fetch(WORKER+"/health").then(r=>{if(!r.ok)throw new Error();return r.json();}).then(()=>{
    $("gatewayStatus").className="status online";$("gatewayStatus").lastElementChild.textContent=t("online");
  }).catch(()=>{
    $("gatewayStatus").className="status offline";$("gatewayStatus").lastElementChild.textContent=t("offline");
  });
  updateNav();
})();