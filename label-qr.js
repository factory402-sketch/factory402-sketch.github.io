function showRecipeQR(recipe, feedback) {
  const url = RecipeLink.make(recipe);
  const code = new LabelQR(0, 0); // Automatic version, medium error correction.
  code.addData(url);
  try { code.make(); }
  catch { feedback('레시피 내용이 길어 QR을 만들 수 없어요. 이름이나 메모를 줄이거나 공유 링크를 이용해 주세요.'); return; }

  const quiet = 5;
  const cells = code.getModuleCount() + quiet * 2;
  const scale = Math.ceil(1400 / cells);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cells * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--qr-ink').trim() || '#133c32';
  for (let row = 0; row < code.getModuleCount(); row++) {
    for (let col = 0; col < code.getModuleCount(); col++) {
      if (code.isDark(row, col)) ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
    }
  }
  const png = canvas.toDataURL('image/png');
  $('labelName').textContent = recipe.name;
  $('labelImage').src = png;
  $('downloadQR').href = png;
  $('downloadQR').download = recipe.name.replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 75) + '-레시피QR.png';
  $('labelDialog').style.setProperty('--qr-width', Math.max(42, Math.ceil(cells * 0.65)) + 'mm');
  $('qrSendStatus').textContent = '';
  $('sendQR').onclick = async () => {
    const status = $('qrSendStatus');
    try {
      const bytes = Uint8Array.from(atob(png.split(',')[1]), ch => ch.charCodeAt(0));
      const file = new File([bytes], $('downloadQR').download, {type:'image/png'});
      if (navigator.canShare?.({files:[file]})) {
        await navigator.share({files:[file], title:recipe.name});
      } else {
        status.textContent = 'QR 이미지 저장을 누른 뒤 메시지에 이미지를 첨부해 주세요.';
      }
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'QR 이미지 저장으로 파일을 내려받아 보내주세요.';
    }
  };
  $('labelDialog').showModal();window.recordFeature?.('qr');
}
document.getElementById('printQR').onclick = () => window.print();
