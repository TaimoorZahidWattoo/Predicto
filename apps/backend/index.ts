import express, { response } from "express";
import cors from "cors";
import { uuid } from "uuidv4";
import { middleware } from "./middleware";
import { prisma } from "db";
import { CreateOrderSchema, type Orderbook } from "./types";
import { SplitSchema } from "./types";


const app = express();
app.use(express.json());
app.use(cors());


app.post("/order", middleware , async (req, res) => {
    const { success, data } = CreateOrderSchema.safeParse(req.body);
    const userId: string = req.userId;

    if (!success) {
         res.status(411).json({
            message: "Invalid inputs",
        })
        return;
    }

    const originalOrderId = uuid();

    await prisma.$transaction(async tx => {
        const response = await tx.$queryRaw<{
            yesOrderbook: string,
            noOrderbook: string, 
            id: string, 
            totalQty: number
        }[]>`SELECT * FROM "Market" WHERE id = ${data.marketId} FOR UPDATE;`;
        
        const userResponse =await tx.$queryRaw<{
            id: string,
            address: string,
            usdBalance: number
        }[]>`SELECT * FROM "User" WHERE id = ${userId} FOR UPDATE;`;
        
        const market = response[0];
        const user = userResponse[0];
        if (!market) {
            
            return;
        }
        if (!user) {
            
            return;
        }


        const yesOrderbook: Orderbook = JSON.parse(market.yesOrderbook);
        const noOrderbook: Orderbook = JSON.parse(market.noOrderbook);
        
        if (data.side == "yes" && data.type == "buy") {  
            const usd = data.qty * data.price;
            if (user.usdBalance < usd) {
                res.status(403).json({
                    message: "Insufficient balance"
                })
                return;
            }

            let leftQty = data.qty;
            const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a)-Number(b) );

            await Promise.all(prices.map(async (price)  => {
                if (Number(price) > data.price) {
                    return;
                }

                const { availableQty, orders } = yesOrderbook[price]!;

                await Promise.all(orders.map(async (order) => {

                    const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
                    const reverseOrder = order.reverseOrder;

                    if (reverseOrder) {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "Yes"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    increment: matchedQty * Number(price)
                                }
                            }
                        
                        })

                    } 
                    else {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    decrement: matchedQty * (100 - Number(price))
                                }
                            }
                        })
                    }
                        
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId,
                                    marketId: data.marketId,
                                    type: "Yes"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        
                        })
                        await prisma.user.update({
                            where: {
                                id: userId,                                
                            },
                            data: {
                                usdBalance: {
                                    decrement: matchedQty * Number(price)
                                }
                            }
                        
                        })


                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        yesOrderbook[price]!.availableQty -= matchedQty;

                }))
            }))

            if (leftQty > 0) {
                const oppositePrice = 100 - data.price;
                if (!noOrderbook[oppositePrice]) {

                    noOrderbook[oppositePrice] = {
                        availableQty: 0,
                        orders: []
                    }
                }

                noOrderbook[oppositePrice]!.availableQty += leftQty;
                noOrderbook[oppositePrice]!.orders.push({
                    userId,
                    qty: leftQty,
                    filledQty: 0,
                    originalOrderId,
                    reverseOrder: true
                })
            }
        }

        if (data.side == "yes" && data.type == "sell") {

            const buyPrice = 100- data.price;

            const userPosition = await prisma.position.findFirst({
                where: {
                    userId: userId,
                    marketId: data.marketId,
                    type: "Yes"
                }
            });

            if(!userPosition){
                return;
            }

            if(userPosition.qty < data.qty) {
                return;
            }

            let leftQty = data.qty;

            const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a)-Number(b) );

            await Promise.all(prices.map(async (price)  => {
                if (Number(price) > buyPrice) {
                    return;
                }

                const { orders } = noOrderbook[price]!;

                await Promise.all(orders.map(async (order) => {

                    const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
                    const reverseOrder = order.reverseOrder;

                    if (reverseOrder) {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    increment: matchedQty * Number(price)
                                }
                            }
                        
                        })

                    } 
                    else {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "Yes"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    decrement: matchedQty * (100 - Number(price))
                                }
                            }
                        })
                    }
                        
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId,
                                    marketId: data.marketId,
                                    type: "Yes"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        
                        })
                        await prisma.user.update({
                            where: {
                                id: userId,                                
                            },
                            data: {
                                usdBalance: {
                                    increment: matchedQty * Number(price)
                                }
                            }
                        
                        })


                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        noOrderbook[price]!.availableQty -= matchedQty;

                }))
            }))
            if (leftQty > 0) { 

                if (!yesOrderbook[data.price]) {

                    yesOrderbook[data.price] = {
                        availableQty: 0,
                        orders: []
                    }
                }

                yesOrderbook[data.price]!.availableQty += leftQty;
                yesOrderbook[data.price]!.orders.push({
                    userId,
                    qty: leftQty,
                    filledQty: 0,
                    originalOrderId,
                    reverseOrder: false
                })
            }

            
        }

        if (data.side == "no" && data.type == "buy") {
            const usd = data.qty * data.price;
            if (user.usdBalance < usd) {
                res.status(403).json({
                    message: "Insufficient balance"
                })
                return;
            }

            let leftQty = data.qty;
            const prices = Object.keys(noOrderbook).sort((a: string, b: string) => Number(a)-Number(b) );

            await Promise.all(prices.map(async (price)  => {
                if (Number(price) > data.price) {
                    return;
                }

                const { availableQty, orders } = noOrderbook[price]!;

                await Promise.all(orders.map(async (order) => {

                    const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
                    const reverseOrder = order.reverseOrder;

                    if (reverseOrder) {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    increment: matchedQty * Number(price)
                                }
                            }
                        
                        })

                    } 
                    else {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "Yes"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    decrement: matchedQty * (100 - Number(price))
                                }
                            }
                        })
                    }
                        
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        
                        })
                        await prisma.user.update({
                            where: {
                                id: userId,                                
                            },
                            data: {
                                usdBalance: {
                                    decrement: matchedQty * Number(price)
                                }
                            }
                        
                        })


                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        noOrderbook[price]!.availableQty -= matchedQty;

                }))
            }))

            if (leftQty > 0) {
                const oppositePrice = 100 - data.price;
                if (!yesOrderbook[oppositePrice]) {

                    yesOrderbook[oppositePrice] = {
                        availableQty: 0,
                        orders: []
                    }
                }

                yesOrderbook[oppositePrice]!.availableQty += leftQty;
                yesOrderbook[oppositePrice]!.orders.push({
                    userId,
                    qty: leftQty,
                    filledQty: 0,
                    originalOrderId,
                    reverseOrder: true
                })
            }
        }


        if (data.side == "no" && data.type == "sell") {

            const buyPrice = 100- data.price;

            const userPosition = await prisma.position.findFirst({
                where: {
                    userId: userId,
                    marketId: data.marketId,
                    type: "No"
                }
            });

            if(!userPosition){
                return;
            }

            if(userPosition.qty < data.qty) {
                return;
            }

            let leftQty = data.qty;

            const prices = Object.keys(noOrderbook).sort((a: string, b: string) => Number(a)-Number(b) );

            await Promise.all(prices.map(async (price)  => {
                if (Number(price) > buyPrice) {
                    return;
                }

                const { orders } = yesOrderbook[price]!;

                await Promise.all(orders.map(async (order) => {

                    const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
                    const reverseOrder = order.reverseOrder;

                    if (reverseOrder) {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "Yes"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    increment: matchedQty * Number(price)
                                }
                            }
                        
                        })

                    } 
                    else {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,                                
                            },
                            data: {
                                usdBalance: {
                                    decrement: matchedQty * (100 - Number(price))
                                }
                            }
                        })
                    }
                        
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {
                                    userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        
                        })
                        await prisma.user.update({
                            where: {
                                id: userId,                                
                            },
                            data: {
                                usdBalance: {
                                    increment: matchedQty * Number(price)
                                }
                            }
                        
                        })


                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        yesOrderbook[price]!.availableQty -= matchedQty;

                }))
            }))
            if (leftQty > 0) { 

                if (!noOrderbook[data.price]) {

                    noOrderbook[data.price] = {
                        availableQty: 0,
                        orders: []
                    }
                }

                noOrderbook[data.price]!.availableQty += leftQty;
                noOrderbook[data.price]!.orders.push({
                    userId,
                    qty: leftQty,
                    filledQty: 0,
                    originalOrderId,
                    reverseOrder: false
                })
            }

            
        }


        await prisma.orderHistory.create({
            data: {
                id: originalOrderId,
                orderType: data.type === "buy" ? "Buy" : "Sell",
                marketId: data.marketId,
                price: data.price,
                qty: data.qty,
                userId: userId,
            }
        });
        await tx.market.update({
            data: {
                yesOrderbook: JSON.stringify(yesOrderbook),
                noOrderbook: JSON.stringify(noOrderbook)
            },
            where: {
                id: data.marketId
            }
        });

    });
})


app.get("/market",middleware , async (req, res) => {
    const market = await prisma.market.findFirst({
        where: {
            id: req.query.marketId as string
        }
    });
    res.json(market);
})


app.post("/split",middleware,  async(req, res) => {

    const { data, success } = SplitSchema.safeParse(req.body);
    const userId: string = req.userId;
    if(!success) {
        res.status(411).json({
            message: "Invalid inputs"
        })
        return;
    }
    const marketId = data?.marketId;

    await prisma.$transaction(async tx => {
        const userResponse =await tx.$queryRaw<{
            id: string,
            address: string,
            usdBalance: number
        }[]>`SELECT * FROM "User" WHERE id = ${userId} FOR UPDATE;`;

        const user = userResponse[0];
        
        if (!user) {
            throw new Error("User not found");
        }
        if(user.usdBalance < data.amount) {
            res.status(403).json({
                message: "Insufficient balance"
            })
            return;
        }

        await tx.user.update({
            where: {
                id: userId
            },
            data: {
                usdBalance: {
                    decrement: data.amount
                }
            }
        })
        await tx.position.upsert({
            where: {
                userId_marketId_type: {
                    userId,
                    marketId,
                    type: "Yes"
                }
            },
            create: {
                userId,
                marketId,
                type: "Yes",
                qty: data.amount
            },
            update: {
                qty: {
                    increment: data.amount
                }
            }
        })
        await tx.position.upsert({
            where: {
                userId_marketId_type: {
                    userId,
                    marketId,
                    type: "No"
                }
            },
            create: {
                userId,
                marketId,
                type: "No",
                qty: data.amount
            },
            update: {
                qty: {
                    increment: data.amount
                }
            }
        })
        await prisma.orderHistory.create({
            data: {
                orderType: "Split",
                marketId: data.marketId,
                price: 0,
                qty: data.amount,
                userId: userId,
            }
        });
    })

})


app.post("/merge",middleware , async (req, res) => {
    const { data, success } = SplitSchema.safeParse(req.body);
    const userId: string = req.userId;
    if(!success) {
        res.status(411).json({
            message: "Invalid inputs"
        })
        return;
    }
    const marketId = data?.marketId;

    await prisma.$transaction(async tx => {
        const userResponse =await tx.$queryRaw<{
            id: string,
            address: string,
            usdBalance: number
        }[]>`SELECT * FROM "User" WHERE id = ${userId} FOR UPDATE;`;
        const user = userResponse[0];
        if (!user) {
            throw new Error("User not found");
        }
        const yesPosition = await tx.position.findFirst({
            where: {
                userId,
                marketId,
                type: "Yes"
            }
        });

        const noPosition = await tx.position.findFirst({
            where: {
                userId,
                marketId,
                type: "No"
            }
        });

        if(!yesPosition || yesPosition.qty < data.amount ){
            res.status(403).json({
                message: "Insufficient Yes position"
            })
            return;
        }
        if(!noPosition || noPosition.qty < data.amount ){
            res.status(403).json({
                message: "Insufficient No position"
            })
            return;
        }

        await tx.position.update({
            where: {
                userId_marketId_type: {
                    userId,
                    marketId,
                    type: "Yes"
                }
            },
            data: {
                qty: {
                    decrement: data.amount
                }
            }
        })
        await tx.position.update({
            where: {
                userId_marketId_type: {
                    userId,
                    marketId,
                    type: "No"
                }
            },
            data: {
                qty: {
                    decrement: data.amount
                }
            }
        })

        await tx.user.update({
            where: {
                id: userId
            },
            data: {
                usdBalance: {
                    increment: data.amount
                }
            }
        })

        await prisma.orderHistory.create({
            data: {
                orderType: "Merge",
                marketId: data.marketId,
                price: 0,
                qty: data.amount,
                userId: userId,
            }
        });
    })
})  


app.get("/balance",middleware , async (req, res) => {
    const userId: string = req.userId;
    const user = await prisma.user.findFirst({
        where: {
            id: userId
        }
    });
    res.json({
        balance: user?.usdBalance,
    })
})


app.get("/positions",middleware , async (req, res) => {
    const userId: string = req.userId;
    const positions = await prisma.position.findMany({
        where: {
            userId: userId
        }
    });
    res.json(positions);
})


app.get("/history",middleware , async (req, res) => {
    const userId: string = req.userId;
    const history = await prisma.orderHistory.findMany({
        where: {
            userId: userId
        }
    });
    res.json(history);
})

 
app.listen(3000); 