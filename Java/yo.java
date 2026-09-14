public class yo {

    class A implements Runnable {
        public void run() {
            for (int i = 1; i <= 5; i++) {
                System.out.println("I am in A - " + i);
            }
        }
    }

    class B implements Runnable {
        public void run() {
            for (int i = 1; i <= 5; i++) {
                System.out.println("I am in B - " + i);
            }
        }
    }

    class C implements Runnable {
        public void run() {
            for (int i = 1; i <= 5; i++) {
                System.out.println("I am in C - " + i);
            }
        }
    }

    public static void main(String[] args) {

        yo obj = new yo();

        A a = obj.new A();
        B b = obj.new B();
        C c = obj.new C();

        Thread t1 = new Thread(a);
        Thread t2 = new Thread(b);
        Thread t3 = new Thread(c);

        t1.run();
        t2.run();
        t3.run();
    }
}
