
export default function ShareButton() {
  const handleShare = () => {
    const text = encodeURIComponent("Deno Sandbox Memo by git!\n");
    const url = encodeURIComponent(
      "https://deno-sandbox-memo.octo8080x.deno.net/",
    );
    const hashtags = encodeURIComponent("Deno,sandbox,git");
    globalThis.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=${hashtags}`,
      "_blank",
    );
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      class="btn btn-neutral shadow-lg hover:scale-105 transition-transform"
    >
      Share on 𝕏
    </button>
  );
}
