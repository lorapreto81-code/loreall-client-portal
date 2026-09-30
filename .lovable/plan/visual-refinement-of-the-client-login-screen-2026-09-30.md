# Visual refinement of the client login screen

Only the look changes. Login, code sending and checking, "Experimente grátis", the "Indique e ganhe" campaign and all links stay exactly as they are. The page order stays the same:

```text
Logo -> Acesse sua conta -> Identifique-se card -> field -> RECEBER CÓDIGO DE ACESSO
     -> Experimente grátis -> Indique e ganhe banner -> security / footer
```

## What changes

1. **Logo and header**
   - Logo slightly larger (about 70px to 84px), centered, unchanged.
   - Very soft blue, cyan and purple glow behind the logo.
   - More even spacing between the logo, "Acesse sua conta" (larger, bold) and "Loreall Play" (small, muted).

2. **Main card**
   - Slightly lighter, a little see-through background.
   - Thin border, rounded corners and a very soft shadow.
   - A thin cyan to blue to purple line across the top, the same as the renewal page.

3. **Input field**
   - Taller (52px), better contrast, clearer icon.
   - When tapped: cyan border with a soft cyan glow.
   - Same text and same behavior.

4. **"RECEBER CÓDIGO DE ACESSO" button**
   - Same blue to purple gradient as the checkout.
   - Taller (56px), rounded corners.
   - Gentle brightening on hover instead of the zoom.
   - Keeps its icon and the spinning loader while the code is sent.
   - The "Desbloquear Agora" button on the code step gets the same style.

5. **"Novo por aqui? Experimente grátis"**
   - Stays small and secondary. "Experimente grátis" is highlighted in cyan and is the only clickable part.

6. **"Indique e ganhe" banner**
   - Same images, links and rotation.
   - A bit narrower (about 92% width), rounded corners, subtle border and soft shadow.
   - More space above it, so it sits clearly below the login.
   - The dots under the banner lose their glow and get smaller.

7. **Background**
   - Stays dark. It gets a soft blue/cyan glow at the top near the logo and a very light purple glow at the bottom.
   - No particles and no continuous effects.

8. **Footer**
   - "Acesso 100% seguro e protegido" (with a small lock icon instead of the emoji) and "© Loreall Play TV…" in smaller, softer text.

9. **Phones**
   - Tighter vertical spacing on small screens, no sideways scrolling and comfortable tap areas.
   - Checked on 360px and 390px phones and on desktop with screenshots.

## Question for you

The banner currently switches automatically between "Renove" and "Indique e ganhe" every 5 seconds. Your brief asks for no continuous animations. I will keep the automatic switch unless you want it to change only when the customer taps the dots.

## Technical details

- Files: `src/pages/Login.tsx` (header, glows, card wrapper, banner, footer) and `src/features/auth/components/LoginForm.tsx` (input, button, "Experimente grátis" classes only).
- Only semantic tokens are used (primary, secondary, accent, card, border, muted-foreground). No hook, handler or text changes.
