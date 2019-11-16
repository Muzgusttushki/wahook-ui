import * as platform from 'platform';
import { parse } from 'cookie-parse';
import * as url_parse from 'url-parse';


class InticketsDelivery {
  constructor() {
    // 1. Create a new XMLHttpRequest object
    let xhr = new XMLHttpRequest();

    // 2. Configure it: GET-request for the URL /article/.../load
    xhr.open('POST', 'https://api.collector.weekendagency.ru/analytics.init', false);
    xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");

    const cookies = parse(document.cookie);

    console.log(url_parse(location.href, true), 'finder->utm')
    const utm = {
      source: document.referrer,
      tags: url_parse(location.href, true).query || {}
    };

    xhr.send(JSON.stringify({
      widget: {
        browser: {
          name: platform.name,
          version: platform.version
        },

        os: {
          name: platform.os.family,
          arch: platform.os.architecture
        },

        analytics: {
          google: cookies['_ga'],
          facebook: cookies['_fbp'],
          yandex: cookies['_ym_d']
        },

        utm
      }
    }))

    this.ssid = xhr.response;

    this.format = function (address) {
      const match = address.match(/(([12]\d{3}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])))()()_(([01]\d|2[0123]):([012345]\d)) ?([\s\S]*)/);
      const stateDate = match[1];

      return {
        date: new Date(stateDate.substr(0, 4),
          stateDate.substr(4, 2) - 1,
          stateDate.substr(6, 2), match[8], match[9]),
        name: match[10]
      };
    }

    this.response = function (address, response, method = 'POST') {
      fetch(`https://api.collector.weekendagency.ru/${address}`, {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },

        body: JSON.stringify({
          session: this.ssid, widget: response
        }),
      }).catch(console.error)
    }
  }


  setEvent(id, name) {
    const state = this.format(name);
    this.response('analytics.setEvent', {
      id,
      ...state,
      status: 'WIDGET_LAZY'
    });
  }

  seatAdd(name, price, quantity, variant) {
    const event = this.format(name);

    this.response('analytics.seat', {
      event,
      price,
      quantity,
      variant,
      status: 'WIDGET_SEAT'
    });
  }

  seatRemove(name, price, quantity, variant) {
    const event = this.format(name);

    this.response('analytics.seat', {
      event,
      price,
      quantity,
      variant,
      status: 'WIDGET_UNSEAT'
    }, 'DELETE')
  }

  orderStart(id) {
    this.response('analytics.order', {
      status: 'WIDGET_ORDER'
    })
  }

  orderEnd(payment, customer, tickets) {
    tickets = tickets.flatMap(ticket => {
      return {
        discount: {
          type: ticket.discount_type,
          value: ticket.discount
        },

        event: {
          id: ticket.event_id,
          ...this.format(ticket.name)
        },

        price: ticket.price,
        tariff: ticket.tariff,
        quantity: ticket.quantity,
        promocode: ticket.promocode,
        variant: ticket.variant
      }
    })


    this.response('analytics.orderEnd', {
      tickets,
      buyer: customer,
      ...payment,
      status: 'WIDGET_SUCCESS'
    })
  }

  orderPayment() {
    this.response('analytics.payment', {});
  }
}

function bootstrap() {
  let session = null;
  const poolOfMessage = [];

  window.addEventListener('message', function (event) {
    if (typeof event.data === 'string' && event.data.indexOf('intickets_any') > -1) {
      const message = JSON.parse(event.data);
      message['intickets_any'].forEach(event => {
        if (event.hit === 'widget.opened') {
          poolOfMessage.push({
            offset: event.hit,
            content: []
          })
        } else if (event.hit === 'event.details') {
          poolOfMessage.push({
            offset: event.hit,
            content: [event['event'].id, event['event'].name]
          })
        } else if (event.hit === 'seat.add') {
          const ticket = event['tickets'][0];
          poolOfMessage.push({
            offset: event.hit,
            content: [ticket.name, ticket.price, ticket.quantity, ticket.variant]
          })
        } else if (event.hit === 'seat.remove') {
          const ticket = event['tickets'][0];
          poolOfMessage.push({
            offset: event.hit,
            content: [ticket.name, ticket.price, ticket.quantity, ticket.variant]
          })
        } else if (event.hit === 'order.started') {
          poolOfMessage.push({
            offset: event.hit,
            content: [event.order.id]
          })
        } else if (event.hit === 'order.confirmed') {
          poolOfMessage.push({
            offset: event.hit,
            content: [event.order, event.customer, event.tickets]
          })
        } else if (event.hit === 'order.paid_online') {
          poolOfMessage.push({
            offset: event.hit,
            content: []
          })
        }
      })
    }
  });

  const session_id = '';



  setTimeout(async function test() {
    if (poolOfMessage.length) {
      const message = poolOfMessage.shift();

      await fetch(`https://api.collector.weekendagency.ru/${address}`, {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },

        body: JSON.stringify({
          session: this.ssid, widget: response
        }),
      }).catch(console.error)
    }

    test();
  }, 100);
}

bootstrap();