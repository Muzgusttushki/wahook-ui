import { Mutex } from 'async-mutex';
import * as platform from 'platform';
import { parse } from 'cookie-parse';
import * as url_parse from 'url-parse';
import * as $axios from 'axios'

class WahookSession {
    constructor() {
        this.mutex = new Mutex();
        this.address = 'https://api.collector.weekendagency.ru';

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
    }

    async init() {
        const realese = await this.mutex.acquire();
        try {
            const cookies = parse(document.cookie);
            console.log(url_parse(location.href, true).query, 'utm->parse')
            const utm = {
                source: document.referrer,
                tags: url_parse(location.href, true).query || {}
            };

            const request = await $axios.post(`${this.address}/v1/entries/analysis/widget.open`, {
                browser: {
                    name: platform.name,
                    version: platform.version
                },

                os: {
                    name: platform.os.family,
                    arch: platform.os.architecture
                },

                product: platform.product,
                analytics: {
                    google: cookies['_ga'],
                    facebook: cookies['_fbp'],
                    yandex: cookies['_ym_d']
                },

                utm
            });

            this.session = request['data'];
        } catch (error) {
            console.error(error)
        } finally {
            realese();
        }
    }

    async lazy(event) {
        const realese = await this.mutex.acquire();

        try {
            const state = this.format(event.detail.name)
            await $axios.post(`${this.address}/v1/entries/analysis/widget.lazy`, {
                event: {
                    id: event.detail.id,
                    ...state
                },

                session: this.session
            });
        } catch (error) { console.error(error) } finally {
            realese()
        }
    }

    async seat(event) {
        const realese = await this.mutex.acquire();

        try {
            await $axios.post(`${this.address}/v1/entries/analysis/widget.seat`, {
                price: event.detail.price,
                quantity: event.detail.quantity,
                variant: event.detail.variant,

                session: this.session
            });
        } catch (error) { console.error(error) } finally {
            realese()
        }
    }

    async unseat(event) {
        const realese = await this.mutex.acquire();

        try {
            await $axios.post(`${this.address}/v1/entries/analysis/widget.unseat`, {
                price: event.detail.price,
                quantity: event.detail.quantity,
                variant: event.detail.variant,
                session: this.session
            });
        } catch (error) { console.error(error) } finally {
            realese()
        }
    }

    async order() {
        const realese = await this.mutex.acquire();

        try {
            await $axios.post(`${this.address}/v1/entries/analysis/widget.order`, {
                session: this.session
            });
        } catch (error) { console.error(error) } finally {
            realese()
        }
    }

    async confirm(event) {
        const realese = await this.mutex.acquire();

        try {
            event.detail.tickets = event.detail.tickets.flatMap(ticket => {
                return {
                    discount: {
                        type: ticket.discount_type,
                        value: ticket.discount
                    },

                    price: ticket.price,
                    tariff: ticket.tariff,
                    quantity: ticket.quantity,
                    promocode: ticket.promocode,
                    variant: ticket.variant
                }
            })

            await $axios.post(`${this.address}/v1/entries/analysis/widget.confirm`, {

                tickets: event.detail.tickets,
                buyer: event.detail.customer,
                orderId: event.detail.payment.id,
                payment: event.detail.payment.payment,
                session: this.session
            });


        } catch (error) { console.error(error) } finally {
            realese()
        }
    }

    async payment() {
        const realese = await this.mutex.acquire();
        try {
            await $axios.post(`${this.address}/v1/entries/analysis/widget.payment`, {
                session: this.session
            });
        } catch (error) { console.error(error) } finally {
            realese()
        }
    }
}


function bootstrap() {
    let session = null;
    document.addEventListener('wahook->sheets', async function (event) {
        try {
            const utm = {
                source: document.referrer,
                tags: url_parse(location.href, true).query || {}
            };
            const cookies = parse(document.cookie);
            await $axios.post(`https://api.collector.weekendagency.ru/v1/entries/analysis.sheet`, {
                analytics: {
                    google: cookies['_ga'],
                    facebook: cookies['_fbp'],
                    yandex: cookies['_ym_d']
                },
                browser: {
                    name: platform.name,
                    version: platform.version
                },

                os: {
                    name: platform.os.family,
                    arch: platform.os.architecture
                },

                product: platform.product,
                utm,


                source: location.href
            });
        } catch (error) {
            console.log(error, 'wahook')
        }
    })

    document.addEventListener('wahook->init', async function (event) {
        session = new WahookSession();
        await session.init(event)
    })

    document.addEventListener('wahook->lazy', async function (event) {
        await session.lazy(event)
    })

    document.addEventListener('wahook->seat', async function (event) {
        await session.seat(event)
    })

    document.addEventListener('wahook->unseat', async function (event) {
        await session.unseat(event)
    })

    document.addEventListener('wahook->order', async function (event) {
        await session.order(event)
    })

    document.addEventListener('wahook->confirm', async function (event) {
        await session.confirm(event)
    })

    document.addEventListener('wahook->payment', async function (event) {
        await session.payment(event)
    })

    window.addEventListener('message', function (event) {
        if (typeof event.data === 'string' && event.data.indexOf('intickets_any') > -1) {
            const message = JSON.parse(event.data);
            message['intickets_any'].forEach(event => {
                if (event.hit === 'widget.opened') {
                    document.dispatchEvent(new Event('wahook->init'));
                } else if (event.hit === 'event.details') {
                    document.dispatchEvent(new CustomEvent('wahook->lazy', {
                        detail: {
                            id: event['event'].id,
                            name: event['event'].name
                        }
                    }));
                } else if (event.hit === 'seat.add') {
                    const ticket = event['tickets'][0];
                    document.dispatchEvent(new CustomEvent('wahook->seat', {
                        detail: {
                            name: ticket.name,
                            price: ticket.price,
                            quantity: ticket.quantity,
                            variant: ticket.variant
                        }
                    }));
                } else if (event.hit === 'seat.remove') {
                    const ticket = event['tickets'][0];
                    document.dispatchEvent(new CustomEvent('wahook->unseat', {
                        detail: {
                            name: ticket.name,
                            price: ticket.price,
                            quantity: ticket.quantity,
                            variant: ticket.variant
                        }
                    }));
                } else if (event.hit === 'order.started') {
                    document.dispatchEvent(new Event('wahook->order'));
                } else if (event.hit === 'order.confirmed') {
                    document.dispatchEvent(new CustomEvent('wahook->confirm', {
                        detail: {
                            payment: event.order,
                            customer: event.customer,
                            tickets: event.tickets
                        }
                    }));
                } else if (event.hit === 'order.paid_online') {
                    document.dispatchEvent(new Event('wahook->payment'));
                }
            })
        }
    });


    document.dispatchEvent(new Event('wahook->sheets'));
}
bootstrap()