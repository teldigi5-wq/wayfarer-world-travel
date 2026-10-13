// Wayfarer opt-in AI overlay; all trip planning remains locally usable.
const $ = id => document.getElementById(id);
const button = $('ai-enhance'), output = $('ai-output'), status = $('ai-status'), access = $('ai-beta-code');
if (button && output && status && access) button.addEventListener('click', async () => {
  output.replaceChildren();
  const code = access.value.trim();
  if (!code) { status.textContent='Enter your Wayfarer beta access code (not a Groq API key).'; access.focus(); return; }
  const trip = Object.fromEntries(new FormData($('trip-form')));
  trip.travelers=Number(trip.travelers); trip.budget=Number(trip.budget);
  status.textContent='Researching with Groq-powered n8n agents…';
  button.disabled=true; button.setAttribute('aria-busy','true');
  try {
    const response = await fetch('/api/ai-plan', {
      method:'POST', headers:{'Content-Type':'application/json','X-Wayfarer-Beta-Token':code},
      body:JSON.stringify({trip}), signal:AbortSignal.timeout(28000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'AI research unavailable.');
    for(const agent of result.agents || []) {
      const card=document.createElement('article'),title=document.createElement('h4'),text=document.createElement('p');
      card.className='ai-report';title.textContent=agent.name;text.textContent=agent.findings;
      card.append(title,text);output.append(card);
    }
    if(result.sourceUrl) {
      const a=document.createElement('a');a.href=result.sourceUrl;a.textContent='Read destination encyclopedia source ↗';
      a.target='_blank';a.rel='noopener noreferrer';output.append(a);
    }
    const limit=document.createElement('p');limit.className='ai-disclaimer';
    limit.textContent=(result.limitations || []).join(' ');output.append(limit);
    status.textContent='Three AI agents responded. Verify details before booking.';
  } catch(error) {
    status.textContent=error?.name==='TimeoutError'
      ?'AI research timed out. Your original trip is unchanged.'
      :(error instanceof TypeError?'AI workflow unreachable. Your local plan still works.':error.message);
  } finally {button.disabled=false;button.removeAttribute('aria-busy');}
});
