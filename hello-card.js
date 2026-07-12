function helloCard(name) {
  return `
    <div class="hello-card">
      <h2>Hello, ${name}!</h2>
      <p>Welcome aboard.</p>
    </div>
  `.trim();
}

module.exports = { helloCard };
