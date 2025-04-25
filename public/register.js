// public/register.js

document.addEventListener("DOMContentLoaded", () => {
  const countrySelect = document.getElementById('country');
  const codeInput = document.getElementById('countryCode');
  const phoneInput = document.getElementById('phoneNumber');
  const phoneError = document.getElementById('phoneError');
  const pinInput = document.getElementById('pin');
  const pinError = document.getElementById('pinError'); // PIN error element
  let countries = [], selected = null;

  fetch('https://upay-2r8z6g7xc-nexus-int.vercel.app/api/countries')
    .then(res => res.json())
    .then(data => {
      countries = data;
      data.forEach(({ country, country_code, flag, phone_length }) => {
        const opt = new Option(`${flag} ${country}`, country_code);
        opt.dataset.len = phone_length;
        countrySelect.add(opt);
      });
    });

  countrySelect.onchange = () => {
    selected = countries.find(c => c.country_code === countrySelect.value);
    codeInput.value = selected?.country_code || '';
    phoneInput.value = '';
    phoneError.style.display = 'none';
  };

  phoneInput.oninput = () => {
    if (selected && phoneInput.value.length === selected.phone_length) {
      phoneError.style.display = 'none';
    }
  };

  document.getElementById('registerForm').onsubmit = e => {
    if (!selected || phoneInput.value.length !== selected.phone_length || pinInput.value.length < 5) {
      e.preventDefault();
      if (!selected) {
        phoneError.textContent = 'Please select a valid country.';
      } else if (phoneInput.value.length !== selected.phone_length) {
        phoneError.textContent = `Phone number must be exactly ${selected.phone_length} digits for ${selected.country}.`;
      } else {
        pinError.textContent = 'PIN must be at least 5 characters long.';
        pinError.style.display = 'block';
      }
      phoneError.style.display = 'block';
    } else {
      phoneInput.value = `${selected.country_code} ${phoneInput.value.trim()}`;
    }
  };
});
