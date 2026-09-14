import java.util.Random;

class first extends Thread {
    public void num() {
        int num;
        Random r = new Random();

        num = r.nextInt(100);

        if (num % 2 == 0) {
            new second(num).start();
        } else {
            new third(num).start();
        }
    }

    public void run() {
        num();
    }
}

class second extends Thread {
    int num;

    second(int num) {
        this.num = num;
    }

    public void run() {
        System.out.println("Number is even: " + num
                + " so the square of number is: " + (num * num));
    }
}

class third extends Thread {
    int num;

    third(int num) {
        this.num = num;
    }

    public void run() {
        System.out.println("Number is odd: " + num
                + " so the cube of number is: " + (num * num * num));
    }
}

public class test {
    public static void main(String[] args) {
        try {
            for (int i = 1; i <= 10; i++) {
                new first().start();
                Thread.sleep(1000);
            }
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
