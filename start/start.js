(function () {
  'use strict';
  var form = document.getElementById('onboarding'), step = 0, brief;
  var fields = form.elements;
  function showStep(n) {
    step = n;
    document.querySelectorAll('[data-step]').forEach(function (el) { el.hidden = Number(el.dataset.step) !== n; });
    document.querySelectorAll('.progress li').forEach(function (el, i) {
      if (i === n) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    // Nonactive steps must not block browser validation of the current step.
    document.querySelectorAll('[data-step]').forEach(function (section) {
      section.querySelectorAll('input, textarea, select').forEach(function (input) { input.disabled = section.hidden; });
    });
    conditionalFields();
    if (n || brief) {
      var heading = document.querySelector('[data-step="' + n + '"] h3');
      heading.setAttribute('tabindex', '-1'); heading.focus({preventScroll: true});
      document.querySelector('.form-panel').scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  }
  function conditionalFields() {
    var bni = fields.preset.value === 'bni', custom = fields.domainType.value === 'custom';
    document.getElementById('bni-fields').hidden = !bni;
    document.getElementById('custom-fields').hidden = !custom;
    ['chapter', 'classification'].forEach(function (key) { fields[key].required = bni; fields[key].disabled = step !== 0 || !bni; });
    fields.customDomain.required = custom;
    fields.customDomain.disabled = step !== 1 || !custom;
    fields.domainOwnership.disabled = step !== 1 || !custom;
  }
  function value(key) { return String(fields[key].value || '').trim(); }
  function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function buildBrief() {
    var wa = value('wa').replace(/\D/g, '');
    if (wa.charAt(0) === '0') wa = '62' + wa.slice(1);
    var bni = fields.preset.value === 'bni', custom = fields.domainType.value === 'custom';
    var data = {
      version: 2, lang_default: 'id',
      hero: {name: value('name'), initials: value('name').split(/\s+/).map(function (n) { return n[0]; }).slice(0, 2).join('').toUpperCase(), role_id: value('role'), role_en: value('role'), connector_id: 'Bio Card', connector_en: 'Bio Card'},
      contact: {email: value('email'), wa: wa, phone_display: '+' + wa},
      wa_form: {head_id: 'Mari terhubung', sub_id: 'Kenalkan dirimu lewat WhatsApp.', fields: [{key: 'name', label_id: 'Nama', required: true}], template_id: 'Halo, saya {name}. Saya baru melihat profil Anda: {link}'},
      pages: [{key: 'about', icon: 'person', tab_id: 'Kenalan', tab_en: 'About', label_id: 'Perkenalan', widgets: [
        {id: 'profile', type: 'profile'}, {id: 'bio', type: 'text', body_id: escapeHtml(value('bio'))}
      ]}]
    };
    if (bni) {
      data.hero.meta = 'BNI ' + value('chapter');
      data.pages.push({key: 'membership', icon: 'badge', tab_id: 'BNI', label_id: 'Keanggotaan BNI', widgets: [
        {id: 'membership-title', type: 'heading', text_id: 'Keanggotaan BNI'},
        {id: 'membership-details', type: 'table', rows: [{label_id: 'Chapter', value_id: value('chapter')}, {label_id: 'Klasifikasi', value_id: value('classification')}]}
      ]});
    }
    data.pages.push({key: 'contact', icon: 'chat', tab_id: 'Kontak', label_id: 'Mari terhubung', dark: true, widgets: [{id: 'contact-title', type: 'heading', text_id: 'Mari terhubung.'}, {id: 'contact', type: 'contact'}]});
    return {schema_version: 1, status: 'draft-not-submitted', preset: fields.preset.value, requested_slug: value('slug'),
      domain: {type: fields.domainType.value, hostname: custom ? value('customDomain').toLowerCase() : null, ownership: custom ? fields.domainOwnership.value : null, setup_required: custom, additional_cost: custom, pricing: 'to-be-confirmed'}, card: data};
  }
  function renderSummary() {
    brief = buildBrief();
    var list = document.getElementById('summary'); list.replaceChildren();
    var rows = [['Nama', brief.card.hero.name], ['Profil', brief.preset === 'bni' ? 'Member BNI' : 'Profesional umum'], ['Nama profil', brief.requested_slug], ['Domain', brief.domain.hostname || 'Domain Increasink (alamat final menyusul)'], ['Status', 'Draft, belum dipublikasikan']];
    rows.forEach(function (row) { var dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = row[0]; dd.textContent = row[1]; list.append(dt, dd); });
    document.getElementById('setup-note').textContent = brief.domain.setup_required ? 'Custom domain memerlukan biaya tambahan dan setup oleh tim. Kepemilikan, DNS, biaya dan aktivasi dikonfirmasi terlebih dahulu.' : 'Nama profil dan alamat final akan dikonfirmasi saat aktivasi di domain Increasink.';
    var frame = document.getElementById('draft-preview');
    frame.onload = function () { frame.contentWindow.postMessage({type: 'biocard-preview', data: brief.card}, location.origin); };
    frame.src = 'preview.html';
  }
  form.addEventListener('change', conditionalFields);
  fields.customDomain.addEventListener('input', function () { this.setCustomValidity(''); });
  fields.name.addEventListener('blur', function () {
    if (!value('slug')) fields.slug.value = value('name').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (step === 0 && (!value('name') || !value('role') || !value('bio'))) return;
    if (step === 1 && fields.domainType.value === 'custom') {
      var domain = value('customDomain');
      var valid = domain.length <= 253 && domain.split('.').length >= 2 && domain.split('.').every(function (part) { return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part); }) && /^[a-z]{2,63}$/i.test(domain.split('.').pop());
      fields.customDomain.setCustomValidity(valid ? '' : 'Masukkan domain seperti connect.namamu.com, tanpa https:// atau path.');
      if (!valid) { fields.customDomain.reportValidity(); return; }
    }
    if (step === 1) renderSummary();
    if (step < 2) showStep(step + 1);
  });
  document.querySelectorAll('[data-back]').forEach(function (button) { button.addEventListener('click', function () { showStep(step - 1); }); });
  document.getElementById('download').addEventListener('click', function () {
    var url = URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2)], {type: 'application/json'}));
    var a = document.createElement('a'); a.href = url; a.download = 'biocard-' + brief.requested_slug + '-draft.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  document.querySelectorAll('[data-example]').forEach(function (button) {
    button.addEventListener('click', function () {
      var bni = button.dataset.example === 'bni', path = bni ? 'https://connect.stephenseptian.com/bni/' : '../profile/';
      document.querySelectorAll('[data-example]').forEach(function (el) { el.setAttribute('aria-pressed', String(el === button)); });
      document.getElementById('example').src = path;
      document.getElementById('example').title = 'Contoh Bio Card Stephen Septian, ' + (bni ? 'member BNI' : 'profesional umum');
      document.getElementById('open-example').href = path;
    });
  });
  // Keep a real phone viewport inside the frame, even when its visual size shrinks.
  var phone = document.querySelector('.phone');
  function sizeExample() {
    var scale = phone.clientWidth / 390;
    phone.style.setProperty('--phone-scale', scale);
    phone.style.height = (779 * scale + 12) + 'px';
  }
  new ResizeObserver(sizeExample).observe(phone);
  sizeExample();
  showStep(0);
})();
