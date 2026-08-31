(() => {
  'use strict';

  const GA_FORM = { form_name: 'orcamento_ecojoi' };
  const WHATSAPP_URL = 'https://wa.me/5547988272706?text=Ol%C3%A1%20Ecojoi!%20Gostaria%20de%20fazer%20um%20or%C3%A7amento.';
  const CAMPAIGN_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
  const form = document.getElementById('form_orcamento');
  const phone = document.getElementById('telefone');
  const status = document.getElementById('form_status');
  let formStarted = false;
  let submitting = false;
  let conversionSent = false;

  const ga = (event, params = {}) => typeof window.gtag === 'function' && window.gtag('event', event, params);
  const meta = (...args) => typeof window.fbq === 'function' && window.fbq(...args);

  function captureCampaign() {
    const params = new URLSearchParams(location.search);
    let campaign = {};
    try { campaign = JSON.parse(sessionStorage.getItem('ecojoi_campaign') || '{}'); } catch (_) {}
    CAMPAIGN_KEYS.forEach(key => { if (params.get(key)) campaign[key] = params.get(key); });
    if (!campaign.entry_url) campaign.entry_url = location.href;
    sessionStorage.setItem('ecojoi_campaign', JSON.stringify(campaign));
    return campaign;
  }

  const campaign = captureCampaign();

  function maskPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.replace(/^(\d{1,2})/, '($1');
    if (digits.length <= 6) return digits.replace(/^(\d{2})(\d+)/, '($1) $2');
    if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
    return digits.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  }

  function setError(input, message) {
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    const error = document.getElementById(`${input.id}-error`);
    if (error) error.textContent = message;
  }

  function validate() {
    const fields = {
      nome: document.getElementById('nome'), telefone: phone,
      quantidade: document.getElementById('quantidade'), produto: document.getElementById('produto')
    };
    const phoneDigits = fields.telefone.value.replace(/\D/g, '');
    const errors = {
      nome: fields.nome.value.trim().length >= 2 ? '' : 'Informe seu nome.',
      telefone: phoneDigits.length === 11 ? '' : 'Informe um celular com DDD.',
      quantidade: Number.isInteger(Number(fields.quantidade.value)) && Number(fields.quantidade.value) > 0 ? '' : 'Informe uma quantidade válida.',
      produto: fields.produto.value ? '' : 'Selecione um produto.'
    };
    Object.keys(fields).forEach(key => setError(fields[key], errors[key]));
    const firstInvalid = Object.keys(errors).find(key => errors[key]);
    if (firstInvalid) fields[firstInvalid].focus();
    return !firstInvalid;
  }

  function buildLead() {
    return {
      nome: document.getElementById('nome').value.trim(),
      telefone: phone.value.replace(/\D/g, ''),
      quantidade: Number(document.getElementById('quantidade').value),
      produto: document.getElementById('produto').value,
      data_hora: new Date().toISOString(),
      url_entrada: campaign.entry_url || location.href,
      url_atual: location.href,
      ...Object.fromEntries(CAMPAIGN_KEYS.map(key => [key, campaign[key] || '']))
    };
  }

  // Ponto único de integração futura. Defina window.ECOJOI_FORM_ENDPOINT antes deste script.
  async function sendLead(lead) {
    if (!window.ECOJOI_FORM_ENDPOINT) {
      window.dispatchEvent(new CustomEvent('ecojoi:lead-ready', { detail: lead }));
      return { ok: false, integrationPending: true };
    }
    const response = await fetch(window.ECOJOI_FORM_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead)
    });
    if (!response.ok) throw new Error('Falha no envio');
    return { ok: true };
  }

  phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); });
  form.addEventListener('input', () => {
    if (!formStarted) { formStarted = true; ga('form_start', GA_FORM); }
  }, { passive: true });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = '';
    status.className = 'form-status';
    if (submitting || !validate()) return;
    submitting = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await sendLead(buildLead());
      if (!result.ok) {
        status.textContent = 'Formulário preenchido. Para concluir agora, fale com nossa equipe pelo WhatsApp.';
        status.classList.add('error-status');
        const link = document.createElement('a');
        link.href = WHATSAPP_URL; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = ' Abrir WhatsApp'; status.appendChild(link);
        return;
      }
      if (!conversionSent) {
        conversionSent = true;
        ga('generate_lead', GA_FORM); ga('form_submit', GA_FORM); meta('track', 'Lead');
      }
      form.reset();
      status.textContent = 'Solicitação recebida! Em breve nossa equipe entrará em contato com você.';
    } catch (_) {
      status.textContent = 'Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp.';
      status.classList.add('error-status');
    } finally { submitting = false; button.disabled = false; }
  });

  document.getElementById('cta_orcamento').addEventListener('click', () => {
    ga('cta_click', { cta_name: 'faca_seu_orcamento', destination: 'formulario' });
  });

  document.getElementById('whatsapp_floating').addEventListener('click', () => {
    ga('whatsapp_click', { contact_method:'whatsapp', location:'floating_button', destination:'5547988272706' });
    meta('trackCustom', 'WhatsAppClick', { location:'floating_button' });
  });

  const popup = document.getElementById('whatsapp_popup');
  const backdrop = document.getElementById('whatsapp_backdrop');
  const popupLink = popup.querySelector('a');
  const closePopup = () => {
    popup.hidden = true; backdrop.hidden = true; document.body.classList.remove('popup-open');
  };
  popup.querySelector('.popup-close').addEventListener('click', closePopup);
  backdrop.addEventListener('click', closePopup);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !popup.hidden) closePopup(); });
  popupLink.addEventListener('click', () => {
    ga('whatsapp_click', { contact_method:'whatsapp', location:'popup', destination:'5547988272706' });
    ga('whatsapp_popup_click'); meta('trackCustom', 'WhatsAppClick', { location:'popup' });
  });

  window.setTimeout(() => {
    backdrop.hidden = false; popup.hidden = false; popup.classList.add('is-visible');
    document.body.classList.add('popup-open');
    ga('whatsapp_popup_view'); popup.querySelector('.popup-button').focus();
  }, 450);

})();

