import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{
  return {name:'MeowDeck',short_name:'MeowDeck',description:'A Little Cat. A Clever Deck.',start_url:'/',scope:'/',display:'standalone',
    background_color:'#172e24',theme_color:'#17372c',icons:[
      {src:'/icons/meowdeck-192.png',sizes:'192x192',type:'image/png'},
      {src:'/icons/meowdeck-512.png',sizes:'512x512',type:'image/png'},
      {src:'/icons/meowdeck-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
