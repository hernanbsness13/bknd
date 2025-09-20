import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
app.use(bodyParser.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Health
app.get('/health', (req, res) => res.send({ status: 'ok' }));

// Verify webhook GET (for Meta)
app.get('/webhook', (req, res) => {
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token === verify_token) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook receiver
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;
    if (!messages) return res.sendStatus(200);

    for (const msg of messages) {
      const from = msg.from; // customer phone
      const text = msg.text?.body || '';
      const phone_number_id = changes.value.metadata?.phone_number_id;

      // Load business config from Supabase (optional)
      let business = null;
      try {
        const { data } = await supabase
          .from('businesses')
          .select('*')
          .eq('phone_number_id', phone_number_id)
          .single();
        business = data || null;
      } catch (err) {
        console.warn('Supabase fetch business error', err?.message || err);
      }

      const contexto = {
        horarios: business?.horarios || 'Lun a Vie 9-18',
        direccion: business?.direccion || '',
        infoExtra: business?.info || ''
      };

      // Simple rule-based reply example
      let replyText = null;
      if (/horari|abre|abren/i.test(text) && contexto.horarios) {
        replyText = `Hola 👋 Estamos abiertos ${contexto.horarios}. ¿Querés reservar?`;
      } else {
        // Call OpenAI Chat Completions (REST) to generate reply
        const prompt = `Eres un asistente de un comercio. Datos:\n- Horarios: ${contexto.horarios}\n- Dirección: ${contexto.direccion}\n- Info extra: ${contexto.infoExtra}\nCliente pregunta: "${text}"\nResponde en español, breve y con tono cercano.`;

        const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 300
          })
        });

        if (openaiResp.ok) {
          const j = await openaiResp.json();
          replyText = j.choices?.[0]?.message?.content?.trim() || 'Perdón, no entendí. Te paso con un humano.';
        } else {
          console.error('OpenAI error', await openaiResp.text());
          replyText = 'Perdón, hubo un error procesando tu pregunta. Te aviso en breve.';
        }
      }

      // Save message to Supabase (best-effort)
      try {
        await supabase.from('messages').insert({
          business_id: business?.id || null,
          from_number: from,
          text,
          response: replyText,
          direction: 'inbound'
        });
      } catch (err) {
        console.warn('Supabase insert message error', err?.message || err);
      }

      // Send reply through WhatsApp Cloud API
      try {
        const resp = await fetch(`https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: from,
            type: 'text',
            text: { body: replyText }
          })
        });
        if (!resp.ok) {
          console.error('WhatsApp send error', await resp.text());
        }
      } catch (err) {
        console.error('WhatsApp send exception', err?.message || err);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error', error?.message || error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
