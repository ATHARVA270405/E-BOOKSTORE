document.addEventListener('DOMContentLoaded', () => {
  let timerInterval;

  const getOtpBtn = document.getElementById('get-otp-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const phoneInput = document.getElementById('phone-input');
  const otpInputs = document.querySelectorAll('.otp-input');
  const statusMsg = document.getElementById('status-msg');

  // ---------- SEND OTP ----------
  getOtpBtn.addEventListener('click', () => {
    const phone = phoneInput.value.trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
      showStatus("Enter a valid mobile number", "error");
      return;
    }

    const phoneNumber = "+91" + phone;

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'get-otp-btn',
        { size: 'invisible' }
      );
    }

    signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
      .then((confirmationResult) => {
        window.confirmationResult = confirmationResult;

        document.getElementById('display-phone').innerText = phoneNumber;
        switchStep('step-phone', 'step-otp');
        otpInputs[0].focus();

        showStatus("OTP sent successfully", "success");
      })
      .catch((error) => {
        console.error(error);
        showStatus(error.message, "error");
      });
  });

  // ---------- OTP INPUT UX ----------
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
      if (input.value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  // ---------- VERIFY OTP ----------
  verifyBtn.addEventListener('click', () => {
    const otp = Array.from(otpInputs).map(i => i.value).join('');

    if (otp.length !== 6) {
      showStatus("Enter complete OTP", "error");
      return;
    }

    confirmationResult.confirm(otp)
      .then((result) => {
        const user = result.user;

        localStorage.setItem("ebook_user", JSON.stringify({
          uid: user.uid,
          phone: user.phoneNumber,
          loginAt: Date.now()
        }));

        showStatus("Login successful!", "success");

        setTimeout(() => {
          window.location.href = "index.html";
        }, 800);
      })
      .catch(() => {
        showStatus("Invalid OTP", "error");
        otpInputs.forEach(i => i.value = '');
        otpInputs[0].focus();
      });
  });

  // ---------- HELPERS ----------
  function showStatus(msg, type) {
    statusMsg.innerText = msg;
    statusMsg.className =
      `mb-6 p-4 rounded-xl text-xs sm:text-sm text-center ${
        type === 'error'
          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      }`;
  }

  function switchStep(hideId, showId) {
    document.getElementById(hideId).classList.add('hidden-step');
    document.getElementById(showId).classList.remove('hidden-step');
    document.getElementById(showId).classList.add('active-step');
  }
});
